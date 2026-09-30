import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";
import { analytics } from "@/lib/client/analytics";
import { getPrisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("ANALYTICS_PERSISTENCE", "none");
  vi.stubEnv("ANALYTICS_CONSOLE", "false");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sinks de analytics", () => {
  it("fica desativado por padrão", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await track("page_view");
    expect(log).not.toHaveBeenCalled();
  });

  it("registra o evento no console quando habilitado", async () => {
    vi.stubEnv("ANALYTICS_CONSOLE", "true");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await track("link_copied", { path: "/" });
    expect(JSON.parse(log.mock.calls[0][1])).toMatchObject({
      name: "link_copied",
      metadata: { path: "/" },
    });
  });

  it("envia os eventos ao Prisma configurado e isola falhas do banco", async () => {
    vi.stubEnv("ANALYTICS_PERSISTENCE", "prisma");
    const create = vi.fn().mockResolvedValue({});
    vi.mocked(getPrisma).mockReturnValue({
      analyticsEvent: { create },
    } as unknown as ReturnType<typeof getPrisma>);
    await track("page_view", { path: "/" });
    expect(create).toHaveBeenCalledWith({
      data: {
        name: "page_view",
        occurredAt: expect.any(Date),
        metadata: { path: "/" },
      },
    });
    create.mockRejectedValue(new Error("database offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(track("page_view")).resolves.toBeUndefined();
  });
});

describe("analytics do navegador", () => {
  it("envia apenas evento e caminho e não duplica eventos do servidor", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      location: {
        pathname: "/gerar-qrcode",
        search: "?url=https://private.example/secret",
      },
    });
    analytics.track("qr_downloaded");
    analytics.track("qr_generated");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      event: "qr_downloaded",
      path: "/gerar-qrcode",
    });
  });

  it("não interrompe a ferramenta quando a coleta falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      location: { pathname: "/" },
    });
    expect(() => analytics.track("link_copied")).not.toThrow();
    await Promise.resolve();
  });
});
