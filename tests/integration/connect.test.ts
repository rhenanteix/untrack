import { randomUUID } from "node:crypto";
import {
  beforeEach,
  afterEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getPrisma } from "@/lib/prisma";
import { connectSystem } from "@/modules/connect/database";
import {
  provisionSource,
  authenticateSource,
  publicRequestSource,
  rotateSourceCredential,
} from "@/modules/connect/sources";
import { ingestEvent } from "@/modules/connect/ingestion";
import {
  claimReceipts,
  processReceipt,
  replayDeadLetter,
} from "@/modules/connect/queue";
import {
  listReceipts,
  sourceHealth,
  purgeConnectData,
} from "@/modules/connect/operations";
import { nativeEventId, RAW_RETENTION_MS } from "@/modules/connect/contract";
import * as aggregation from "@/modules/analytics/aggregation";
import type { Actor } from "@/modules/workspaces/context";
import { POST as postEvent } from "@/app/api/connect/events/route";
import {
  POST as postPublic,
  OPTIONS as publicOptions,
} from "@/app/api/connect/public/[sourceId]/route";
import { recordAnalyticsEvent } from "@/modules/analytics/service";

import { createPixel, pixelStatus } from "@/modules/pixel/service";

const enabled = process.env.CONNECT_INTEGRATION_TESTS === "1";
if (enabled && !new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error("Test database required");
describe.skipIf(!enabled)("Connect PostgreSQL integration", () => {
  let actor: Actor;
  let other: Actor;
  const now = new Date();
  const event = (overrides: Record<string, unknown> = {}) => ({
    event_id: randomUUID(),
    event_name: "page_view",
    event_version: 1,
    occurred_at: now.toISOString(),
    properties: {},
    consent_context: { analytics: "granted" },
    ...overrides,
  });
  async function source(native = false, workspaceId = actor.workspaceId) {
    const { source: created } = await provisionSource(workspaceId, {
      key: `test-${randomUUID()}`,
      type: native ? "owned_asset" : "connector",
      trust: native ? "internal" : "authenticated",
      projection: native ? "native" : "isolated",
      allowedEvents: ["page_view"],
    });
    return connectSystem((tx) =>
      tx.connectSource.findUniqueOrThrow({ where: { id: created.id } }),
    );
  }
  const receipt = (id: string) =>
    connectSystem((tx) =>
      tx.connectReceipt.findUniqueOrThrow({ where: { id } }),
    );
  async function processOne(id: string, at = new Date()) {
    const claims = await claimReceipts(50, at);
    const claim = claims.find((c) => c.id === id);
    expect(claim).toBeDefined();
    return processReceipt(claim!, at);
  }
  beforeEach(async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const db = getPrisma();
    async function tenant(): Promise<Actor> {
      const userId = randomUUID();
      await db.user.create({
        data: {
          id: userId,
          name: "Connect test",
          email: `${userId}@example.test`,
        },
      });
      const ws = await db.workspace.create({
        data: {
          name: "Connect test",
          members: { create: { userId, role: "owner" } },
        },
      });
      return { userId, workspaceId: ws.id, role: "owner" };
    }
    actor = await tenant();
    other = await tenant();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await connectSystem(async (tx) => {
      await tx.workspace.deleteMany({
        where: { id: { in: [actor.workspaceId, other.workspaceId] } },
      });
      await tx.user.deleteMany({
        where: { id: { in: [actor.userId, other.userId] } },
      });
    });
  });
  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("Pixel setup, exact domain, real test receipt, diagnostics and cross-tenant isolation", async () => {
    const s = await createPixel(actor, {
      origins: ["https://one.example", "https://two.example"],
    });
    expect((await pixelStatus(actor, s.id)).status).toBe("Não instalado");
    await expect(pixelStatus(other, s.id)).rejects.toMatchObject({
      status: 404,
    });
    const testId = randomUUID();
    const input = event({
      event_name: "pixel_test",
      properties: { test_id: testId },
    });
    const send = (payload: unknown, origin = "https://two.example") =>
      postPublic(
        new Request("https://linkor.example/api/connect/public/" + s.id, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify(payload),
        }),
        { params: Promise.resolve({ sourceId: s.id }) },
      );
    expect((await send(input, "https://evil.example")).status).toBe(403);
    expect((await send(input)).status).toBe(202);
    const result = await pixelStatus(actor, s.id, testId);
    expect(result.test?.id).toBeTruthy();
    expect(result.status).toBe("Instalado, sem eventos recentes");
    expect((await pixelStatus(actor, s.id, randomUUID())).test).toBeNull();
    expect((await send(input)).status).toBe(200);
    expect((await pixelStatus(actor, s.id)).status).not.toBe(
      "Possível duplicidade",
    );
    await processOne(result.test!.id);
    expect((await pixelStatus(actor, s.id, testId)).test?.state).toBe(
      "normalized",
    );
    expect(
      (
        await send(
          event({ event_name: "cta_click", properties: { goal: "quote" } }),
        )
      ).status,
    ).toBe(202);
    expect((await pixelStatus(actor, s.id)).status).toBe("Recebendo eventos");
    expect(
      (
        await send(
          event({
            event_name: "pixel_diagnostic",
            properties: { reason: "duplicate_installation" },
          }),
        )
      ).status,
    ).toBe(202);
    expect((await pixelStatus(actor, s.id)).status).toBe(
      "Possível duplicidade",
    );
    expect(
      (await send(event({ consent_context: { analytics: "denied" } }))).status,
    ).toBe(422);
    expect((await pixelStatus(actor, s.id)).status).toBe("Precisa de atenção");
  });

  it("normalizes isolated events without entering native analytics", async () => {
    const s = await source();
    const input = event();
    const accepted = await ingestEvent(s, input);
    expect(accepted.state).toBe("queued");
    expect(await processOne(accepted.receiptId)).toBe("normalized");
    const r = await receipt(accepted.receiptId);
    expect(r.normalizedPayload).toMatchObject({
      event_id: input.event_id,
      workspace_id: actor.workspaceId,
      source_connection_id: s.id,
      source_type: "connector",
      journey_id: null,
      session_id: null,
    });
    expect(
      await getPrisma().analyticsEvent.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(0);
    expect((await sourceHealth(actor)).sources[0]).toMatchObject({
      counts: { normalized: 1 },
      upstreamSyncStatus: "unknown",
    });
  });

  it("deduplicates concurrent deliveries and rejects payload mutation", async () => {
    const s = await source();
    const input = event();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => ingestEvent(s, input)),
    );
    expect(new Set(results.map((r) => r.receiptId)).size).toBe(1);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect((await receipt(results[0].receiptId)).duplicateCount).toBe(7);
    const conflict = await ingestEvent(s, {
      ...input,
      properties: { page_category: "product" },
    });
    expect(conflict.conflict).toBe(true);
    expect((await receipt(conflict.receiptId)).rawPayload).toMatchObject({
      properties: {},
    });
  });

  it("scopes event IDs to workspace and source, enforces tenant reads and compound foreign keys", async () => {
    const s1 = await source();
    const s2 = await source(false, other.workspaceId);
    const s3 = await source();
    const input = event();
    const a = await ingestEvent(s1, input);
    const b = await ingestEvent(s2, input);
    const c = await ingestEvent(s3, input);
    expect(new Set([a.receiptId, b.receiptId, c.receiptId]).size).toBe(3);
    await expect(listReceipts(actor, s2.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      listReceipts({ ...actor, workspaceId: other.workspaceId }, s2.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      connectSystem((tx) =>
        tx.connectReceipt.update({
          where: { id: a.receiptId },
          data: { sourceConnectionId: s2.id },
        }),
      ),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("scrubs invalid, denied and untrusted identity payloads", async () => {
    const s = await source();
    for (const [input, context, code] of [
      [
        event({ properties: { email: "private@example.test" } }),
        {},
        "INVALID_EVENT",
      ],
      [event(), { privacyDenied: true }, "CONSENT_DENIED"],
      [event({ consent_context: null }), {}, "CONSENT_REQUIRED"],
      [event({ session_id: "session-other" }), {}, "UNTRUSTED_ASSOCIATION"],
      [event({ workspace_id: other.workspaceId }), {}, "INVALID_EVENT"],
    ] as const) {
      const r = await ingestEvent(s, input, context);
      expect(r.errorCode).toBe(code);
      const stored = await receipt(r.receiptId);
      expect(stored.state).toBe("rejected");
      expect(JSON.stringify(stored.rawPayload)).not.toContain("private");
      expect(stored.rawPayload).not.toHaveProperty("properties");
    }
    expect(await claimReceipts()).toHaveLength(0);
  });

  it("uses event time for late/out-of-order events and never regresses source watermark", async () => {
    const s = await source(true);
    const newer = await ingestEvent(s, event());
    await processOne(newer.receiptId);
    const oldDate = new Date(now.getTime() - 2 * 86_400_000);
    const older = await ingestEvent(
      s,
      event({ occurred_at: oldDate.toISOString() }),
    );
    await processOne(older.receiptId);
    const updated = await connectSystem((tx) =>
      tx.connectSource.findUniqueOrThrow({ where: { id: s.id } }),
    );
    expect(updated.eventWatermark!.toISOString()).toBe(now.toISOString());
    expect(
      await getPrisma().analyticsAggregate.count({
        where: {
          workspaceId: actor.workspaceId,
          bucketStart: { lt: now },
          count: 1,
        },
      }),
    ).toBeGreaterThan(0);
    const tooOld = await ingestEvent(
      s,
      event({
        occurred_at: new Date(now.getTime() - 31 * 86_400_000).toISOString(),
      }),
    );
    expect(tooOld.state).toBe("rejected");
  });

  it("projects through existing analytics and aggregates exactly once", async () => {
    const s = await source(true);
    const input = event();
    const accepted = await ingestEvent(s, input);
    await processOne(accepted.receiptId);
    await ingestEvent(s, input);
    expect(await claimReceipts()).toHaveLength(0);
    const stored = await getPrisma().analyticsEvent.findUniqueOrThrow({
      where: {
        eventId: nativeEventId(actor.workspaceId, input.event_id as string),
      },
    });
    expect(stored.sourceConnectionId).toBe(s.id);
    const buckets = await getPrisma().analyticsAggregate.findMany({
      where: { workspaceId: actor.workspaceId },
    });
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((b) => b.count === 1)).toBe(true);
  });

  it("rolls back event and buckets on aggregation failure, then retries", async () => {
    const s = await source(true);
    const accepted = await ingestEvent(s, event());
    const fail = vi
      .spyOn(aggregation, "aggregateAnalyticsEvent")
      .mockRejectedValueOnce(new Error("temporary"));
    expect(await processOne(accepted.receiptId)).toBe("queued");
    expect(
      await getPrisma().analyticsEvent.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(0);
    expect(
      await getPrisma().analyticsAggregate.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(0);
    const retry = await receipt(accepted.receiptId);
    expect(retry.nextAttemptAt.getTime()).toBeGreaterThan(
      retry.receivedAt.getTime(),
    );
    fail.mockRestore();
    expect(await processOne(accepted.receiptId, retry.nextAttemptAt)).toBe(
      "normalized",
    );
    expect((await receipt(accepted.receiptId)).attempts).toBe(2);
  });

  it("sends exhausted processing to DLQ and audits authorized replay", async () => {
    const s = await source(true);
    const accepted = await ingestEvent(s, event());
    const fail = vi
      .spyOn(aggregation, "aggregateAnalyticsEvent")
      .mockRejectedValue(new Error("temporary"));
    for (let i = 1; i <= 5; i++) {
      const r = await receipt(accepted.receiptId);
      expect(
        await processOne(
          r.id,
          new Date(Math.max(Date.now(), r.nextAttemptAt.getTime())),
        ),
      ).toBe(i === 5 ? "dead_letter" : "queued");
    }
    expect(
      await claimReceipts(50, new Date(Date.now() + 86_400_000)),
    ).toHaveLength(0);
    await expect(
      replayDeadLetter(other, accepted.receiptId),
    ).rejects.toMatchObject({ status: 404 });
    fail.mockRestore();
    await replayDeadLetter(actor, accepted.receiptId);
    expect(await processOne(accepted.receiptId)).toBe("normalized");
    expect((await receipt(accepted.receiptId)).attempts).toBe(6);
    expect(
      await getPrisma().auditLog.count({
        where: {
          workspaceId: actor.workspaceId,
          action: "connect.receipt.replayed",
        },
      }),
    ).toBe(1);
  });

  it("claims concurrently without overlap and fences crashed workers after lease recovery", async () => {
    const s = await source();
    await Promise.all(Array.from({ length: 6 }, () => ingestEvent(s, event())));
    const batches = await Promise.all([claimReceipts(3), claimReceipts(3)]);
    const claims = batches.flat();
    expect(claims).toHaveLength(6);
    expect(new Set(claims.map((c) => c.id)).size).toBe(6);
    const later = new Date(Date.now() + 61_000);
    const recovered = await claimReceipts(10, later);
    expect(recovered).toHaveLength(6);
    expect(await processReceipt(claims[0], later)).toBe("stale");
    expect(
      await connectSystem((tx) =>
        tx.connectDeliveryAttempt.count({
          where: {
            workspaceId: actor.workspaceId,
            number: 1,
            state: "lease_expired",
          },
        }),
      ),
    ).toBe(6);
    for (const claim of recovered)
      expect(await processReceipt(claim, later)).toBe("normalized");
  });

  it("rejects internal associations to missing or other-tenant assets", async () => {
    const s = await source(true);
    for (const extra of [
      { asset_id: "missing", asset_type: "smart_page" },
      { session_id: "missing" },
      { campaign_id: "missing" },
    ]) {
      const accepted = await ingestEvent(s, event(extra));
      expect(await processOne(accepted.receiptId)).toBe("rejected");
    }
    expect(
      await getPrisma().analyticsEvent.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(0);
  });

  it("enforces source credentials, rotation and exact public origins", async () => {
    const { source: s, credential } = await provisionSource(actor.workspaceId, {
      key: "server",
      type: "conversion_api",
      trust: "authenticated",
      allowedEvents: ["page_view"],
    });
    const request = (token: string, origin?: string) =>
      new Request("https://local.test/api/connect/events", {
        headers: {
          authorization: `Bearer ${token}`,
          ...(origin ? { origin } : {}),
        },
      });
    expect((await authenticateSource(request(credential!))).id).toBe(s.id);
    await expect(
      authenticateSource(request(credential!, "https://site.test")),
    ).rejects.toMatchObject({ status: 403 });
    await rotateSourceCredential(actor.workspaceId, s.id);
    await expect(
      authenticateSource(request(credential!)),
    ).rejects.toMatchObject({ status: 401 });
    const { source: p } = await provisionSource(actor.workspaceId, {
      key: "public",
      type: "external_site",
      trust: "public",
      allowedOrigins: ["https://site.test"],
      allowedEvents: ["page_view"],
    });
    expect((await publicRequestSource(p.id, "https://site.test")).id).toBe(
      p.id,
    );
    await expect(
      publicRequestSource(p.id, "https://site.test.evil.test"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("purges raw receipts on schedule without deleting native history", async () => {
    const s = await source(true);
    const accepted = await ingestEvent(s, event());
    await processOne(accepted.receiptId);
    await purgeConnectData(new Date(Date.now() + RAW_RETENTION_MS + 1000));
    const r = await receipt(accepted.receiptId);
    expect(r.rawPayload).toBeNull();
    expect(r.normalizedPayload).not.toBeNull();
    await purgeConnectData(new Date(Date.now() + 366 * 86_400_000));
    expect(
      await connectSystem((tx) =>
        tx.connectReceipt.count({ where: { id: r.id } }),
      ),
    ).toBe(0);
    expect(
      await getPrisma().analyticsEvent.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(1);
  });

  it("commits conversions and their buckets atomically with the inbox", async () => {
    await getPrisma().analyticsGoal.create({
      data: {
        workspaceId: actor.workspaceId,
        name: "View",
        goalType: "PAGE_VIEW",
        eventName: "page_view",
      },
    });
    const s = await source(true);
    const accepted = await ingestEvent(s, event());
    const fail = vi
      .spyOn(aggregation, "aggregateAnalyticsEvent")
      .mockRejectedValueOnce(new Error("unavailable"));
    expect(await processOne(accepted.receiptId)).toBe("queued");
    expect(
      await getPrisma().analyticsConversion.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(0);
    fail.mockRestore();
    expect(
      await processOne(
        accepted.receiptId,
        (await receipt(accepted.receiptId)).nextAttemptAt,
      ),
    ).toBe("normalized");
    expect(
      await getPrisma().analyticsConversion.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(1);
    expect(
      await getPrisma().analyticsEvent.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(2);
    const buckets = await getPrisma().analyticsAggregate.findMany({
      where: { workspaceId: actor.workspaceId, eventName: "goal_completed" },
    });
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((b) => b.count === 1)).toBe(true);
  });

  it("reconciles concurrent legacy and Connect delivery without double counting", async () => {
    const s = await source(true);
    const input = event();
    const accepted = await ingestEvent(s, input);
    const aggregate = vi.spyOn(aggregation, "aggregateAnalyticsEvent");
    await Promise.all([
      processOne(accepted.receiptId),
      recordAnalyticsEvent({
        name: "page_view",
        eventId: input.event_id as string,
        workspaceId: actor.workspaceId,
        occurredAt: now,
      }),
    ]);
    const r = await receipt(accepted.receiptId);
    if (r.state === "queued") await processOne(r.id, r.nextAttemptAt);
    // The legacy writer intentionally aggregates after its commit; await that work in the test.
    await Promise.allSettled(
      aggregate.mock.results.map((result) => result.value),
    );
    expect((await receipt(r.id)).state).toBe("normalized");
    expect(
      await getPrisma().analyticsEvent.count({
        where: { workspaceId: actor.workspaceId },
      }),
    ).toBe(1);
    const buckets = await getPrisma().analyticsAggregate.findMany({
      where: { workspaceId: actor.workspaceId },
    });
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((b) => b.count === 1)).toBe(true);
  });

  it("refuses a second native authority and conflicting reconciliation", async () => {
    const s = await source(true);
    await expect(source(true)).rejects.toMatchObject({ code: "P2002" });
    const input = event();
    const accepted = await ingestEvent(s, input);
    await processOne(accepted.receiptId);
    const legacy = await recordAnalyticsEvent({
      name: "page_view",
      eventId: input.event_id as string,
      workspaceId: actor.workspaceId,
      occurredAt: now,
    });
    expect(legacy.duplicate).toBe(true);
    const otherInput = event();
    await getPrisma().analyticsEvent.create({
      data: {
        eventId: otherInput.event_id as string,
        name: "link_click",
        workspaceId: actor.workspaceId,
        occurredAt: now,
      },
    });
    const conflict = await ingestEvent(s, otherInput);
    expect(await processOne(conflict.receiptId)).toBe("rejected");
    expect((await receipt(conflict.receiptId)).errorCode).toBe(
      "RECONCILIATION_CONFLICT",
    );
  });

  it("runs public HTTP ingestion through CORS, persistence and normalization", async () => {
    const { source: s } = await provisionSource(actor.workspaceId, {
      key: "web",
      type: "external_site",
      trust: "public",
      allowedOrigins: ["https://site.test"],
      allowedEvents: ["page_view"],
    });
    const context = { params: Promise.resolve({ sourceId: s.id }) };
    const req = (body: unknown) =>
      new Request(`https://linkor.test/api/connect/public/${s.id}`, {
        method: "POST",
        headers: {
          origin: "https://site.test",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const preflight = await publicOptions(
      new Request("https://linkor.test", {
        method: "OPTIONS",
        headers: { origin: "https://site.test" },
      }),
      context,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://site.test",
    );
    expect(preflight.headers.has("Access-Control-Allow-Credentials")).toBe(
      false,
    );
    const response = await postPublic(req(event()), context);
    expect(response.status).toBe(202);
    const accepted = await response.json();
    expect(await processOne(accepted.receiptId)).toBe("normalized");
    const denied = await postPublic(
      req(event({ workspace_id: other.workspaceId })),
      context,
    );
    expect(denied.status).toBe(422);
    const noOrigin = await postPublic(
      new Request("https://linkor.test", { method: "POST", body: "{}" }),
      context,
    );
    expect(noOrigin.status).toBe(403);
  });

  it("runs authenticated HTTP delivery and resolves its tenant from the credential", async () => {
    const { credential } = await provisionSource(actor.workspaceId, {
      key: "api",
      type: "conversion_api",
      trust: "authenticated",
      allowedEvents: ["page_view"],
    });
    const input = event();
    const req = () =>
      new Request("https://linkor.test/api/connect/events", {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
    const response = await postEvent(req());
    expect(response.status).toBe(202);
    const accepted = await response.json();
    expect((await receipt(accepted.receiptId)).workspaceId).toBe(
      actor.workspaceId,
    );
    expect((await postEvent(req())).status).toBe(200);
    expect(
      (await postEvent(new Request("https://linkor.test", { method: "POST" })))
        .status,
    ).toBe(401);
  });

  it("exhausts crash recovery attempts without leaving an immortal processing row", async () => {
    const s = await source();
    const accepted = await ingestEvent(s, event());
    let time = new Date();
    for (let i = 1; i <= 5; i++) {
      const claims = await claimReceipts(10, time);
      expect(claims).toHaveLength(1);
      expect(claims[0].attempts).toBe(i);
      time = new Date(time.getTime() + 61_000);
    }
    expect(await claimReceipts(10, time)).toHaveLength(0);
    expect(await receipt(accepted.receiptId)).toMatchObject({
      state: "dead_letter",
      errorCode: "LEASE_EXPIRED",
      leaseToken: null,
    });
  });

  it("does not claim expired payloads and retention closes abandoned attempts", async () => {
    const s = await source();
    const accepted = await ingestEvent(s, event());
    await claimReceipts(10);
    const later = new Date(Date.now() + RAW_RETENTION_MS + 1000);
    expect(await claimReceipts(10, later)).toHaveLength(0);
    await purgeConnectData(later);
    expect(await receipt(accepted.receiptId)).toMatchObject({
      state: "dead_letter",
      errorCode: "PAYLOAD_EXPIRED",
      rawPayload: null,
    });
    await expect(
      replayDeadLetter(actor, accepted.receiptId, later),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("enforces FORCE RLS for a non-owner role with deny-by-default", async () => {
    const a = await source();
    const b = await source(false, other.workspaceId);
    await ingestEvent(a, event());
    await ingestEvent(b, event());
    await claimReceipts(10);
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "CREATE ROLE connect_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS",
      );
      await tx.$executeRawUnsafe(
        'GRANT SELECT ON "ConnectSource", "ConnectReceipt", "ConnectDeliveryAttempt" TO connect_rls_test',
      );
      await tx.$executeRawUnsafe("SET LOCAL ROLE connect_rls_test");
      expect(await tx.connectSource.count()).toBe(0);
      expect(await tx.connectReceipt.count()).toBe(0);
      expect(await tx.connectDeliveryAttempt.count()).toBe(0);
      await tx.$queryRaw`SELECT set_config('app.workspace_id', ${actor.workspaceId}, true)`;
      expect((await tx.connectSource.findMany()).map((s) => s.id)).toEqual([
        a.id,
      ]);
      expect(await tx.connectReceipt.count()).toBe(1);
      expect(await tx.connectDeliveryAttempt.count()).toBe(1);
      await tx.$executeRawUnsafe("RESET ROLE");
      await tx.$executeRawUnsafe("DROP OWNED BY connect_rls_test");
      await tx.$executeRawUnsafe("DROP ROLE connect_rls_test");
    });
  });
});
