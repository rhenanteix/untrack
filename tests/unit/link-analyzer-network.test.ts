import { EventEmitter } from "node:events";
import type { RequestOptions } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ default: { request: mocks.request } }));
vi.mock("node:https", () => ({ default: { request: mocks.request } }));
import {
  inspectNetwork,
  NETWORK_LIMITS,
} from "@/modules/link-analyzer/network";

type Reply = {
  status?: number;
  location?: string;
  size?: number;
  declaredSize?: number;
  aborted?: boolean;
  hang?: boolean;
};
function serve(replies: Reply[]) {
  mocks.request.mockImplementation(
    (
      options: RequestOptions & { signal: AbortSignal },
      callback: (response: EventEmitter) => void,
    ) => {
      const request = Object.assign(new EventEmitter(), {
        end: vi.fn(),
        destroy: vi.fn(),
      });
      request.destroy.mockImplementation((error?: Error) => {
        if (error) request.emit("error", error);
      });
      request.end.mockImplementation(() => {
        const abort = () => request.emit("error", options.signal.reason);
        options.signal.addEventListener("abort", abort, { once: true });
        const reply = replies.shift() ?? {};
        if (reply.hang) return;
        queueMicrotask(() => {
          const response = Object.assign(new EventEmitter(), {
            statusCode: reply.status ?? 200,
            headers: {
              location: reply.location,
              "content-length": reply.declaredSize?.toString(),
            },
            destroy: vi.fn(),
          });
          callback(response);
          if (!response.destroy.mock.calls.length) {
            if (reply.aborted) response.emit("aborted");
            else {
              response.emit("data", Buffer.alloc(reply.size ?? 0));
              response.emit("end");
            }
          }
          options.signal.removeEventListener("abort", abort);
        });
      });
      return request;
    },
  );
}
const inspect = (url = "https://example.com/start") =>
  inspectNetwork(new URL(url));
beforeEach(() => {
  mocks.lookup
    .mockReset()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mocks.request.mockReset();
  serve([{}]);
});
afterEach(() => vi.useRealTimers());

describe("Analyzer SSRF / transport", () => {
  it.each([
    "http://localhost",
    "http://LOCALHOST.",
    "http://foo.localhost",
    "http://service.local",
    "http://metadata.google.internal",
    "http://metadata",
    "http://168.63.129.16",
    "http://127.0.0.1",
    "http://127.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://0.0.0.0",
    "http://10.1.2.3",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://100.100.100.200",
    "http://224.0.0.1",
    "http://255.255.255.255",
    "http://[::1]",
    "http://[::]",
    "http://[fc00::1]",
    "http://[fe80::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[2002:7f00:1::]",
    "http://[64:ff9b::7f00:1]",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/plain,x",
    "ftp://example.com",
    "http://user:pass@example.com",
  ])("bloqueia antes da conexão: %s", async (url) => {
    expect(await inspect(url)).toMatchObject({
      status: "blocked",
      error: { code: "UNSAFE_URL" },
      finalDestination: null,
    });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejeita DNS misto, mesmo que o primeiro IP seja público", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "::1", family: 6 },
    ]);
    expect((await inspect()).status).toBe("blocked");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it.each([
    { addresses: [] },
    { addresses: [{ address: "invalid", family: 4 }] },
    { addresses: [{ address: "169.254.169.254", family: 4 }] },
  ])("rejeita respostas DNS inseguras: %j", async ({ addresses }) => {
    mocks.lookup.mockResolvedValue(addresses);
    expect((await inspect()).status).toBe("blocked");
  });
  it("reporta falha de DNS", async () => {
    mocks.lookup.mockRejectedValue(new Error("ENOTFOUND"));
    expect(await inspect()).toMatchObject({
      status: "failed",
      error: { code: "NETWORK_ERROR" },
    });
  });
  it("fixa IP validado, mantém Host/TLS e não envia fragmento", async () => {
    await inspect("https://example.com:8443/path?q=1#secret");
    const options = mocks.request.mock.calls[0][0];
    expect(options).toMatchObject({
      hostname: "example.com",
      family: 4,
      port: "8443",
      path: "/path?q=1",
      agent: false,
      maxHeaderSize: NETWORK_LIMITS.maxHeaderBytes,
      headers: { Host: "example.com:8443", "Accept-Encoding": "identity" },
    });
    const callback = vi.fn();
    options.lookup("example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  it.each(["https://8.8.8.8", "https://[2606:4700:4700::1111]"])(
    "aceita IP público literal %s",
    async (url) => {
      expect((await inspect(url)).status).toBe("completed");
      expect(mocks.lookup).not.toHaveBeenCalled();
    },
  );
  it.each([301, 302, 303, 307, 308])(
    "segue redirect %s relativo e revalida DNS",
    async (status) => {
      serve([{ status, location: "../final?q=1" }, { status: 204 }]);
      expect(await inspect()).toMatchObject({
        status: "completed",
        httpStatus: 204,
        redirectCount: 1,
        finalDestination: "https://example.com/final?q=1",
        redirectChain: [
          {
            url: "https://example.com/start",
            status,
            destination: "https://example.com/final?q=1",
          },
        ],
      });
      expect(mocks.lookup).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    "http://169.254.169.254",
    "//localhost/admin",
    "file:///etc/passwd",
    "http://user:pass@example.com",
    "javascript:alert(1)",
  ])("bloqueia redirect %s", async (location) => {
    serve([{ status: 302, location }]);
    expect(await inspect()).toMatchObject({
      status: "blocked",
      redirectCount: 0,
      httpStatus: 302,
      finalDestination: null,
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("bloqueia rebinding no mesmo hostname durante redirect", async () => {
    serve([{ status: 302, location: "/next" }]);
    mocks.lookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    expect((await inspect()).status).toBe("blocked");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, "http://["])(
    "reporta Location inválido: %s",
    async (location) => {
      serve([{ status: 302, location }]);
      expect((await inspect()).error?.code).toBe("INVALID_REDIRECT");
    },
  );
  it("detecta loop incluindo fragmentos", async () => {
    serve([{ status: 302, location: "/start#again" }]);
    expect((await inspect()).error?.code).toBe("REDIRECT_LOOP");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("segue no máximo cinco redirects", async () => {
    serve(
      Array.from({ length: 6 }, (_, i) => ({
        status: 302,
        location: `/hop${i}`,
      })),
    );
    expect(await inspect()).toMatchObject({
      error: { code: "TOO_MANY_REDIRECTS" },
      redirectCount: 5,
      finalDestination: null,
    });
    expect(mocks.request).toHaveBeenCalledTimes(6);
  });
  it("permite exatamente cinco redirects", async () => {
    serve([
      ...Array.from({ length: 5 }, (_, i) => ({
        status: 302,
        location: `/hop${i}`,
      })),
      { status: 200 },
    ]);
    expect(await inspect()).toMatchObject({
      status: "completed",
      redirectCount: 5,
    });
  });
  it.each([304, 404, 503])(
    "preserva status terminal %s sem seguir Location",
    async (status) => {
      serve([{ status, location: "http://localhost" }]);
      expect(await inspect()).toMatchObject({
        status: "completed",
        httpStatus: status,
        redirectCount: 0,
      });
    },
  );
  it.each([{ size: 65537 }, { declaredSize: 65537 }])(
    "limita tamanho por bytes e Content-Length: %j",
    async (reply) => {
      serve([reply]);
      expect(await inspect()).toMatchObject({
        httpStatus: 200,
        finalDestination: null,
        error: { code: "RESPONSE_TOO_LARGE" },
      });
    },
  );
  it("aceita resposta exatamente no limite", async () => {
    serve([{ size: 65536 }]);
    expect((await inspect()).status).toBe("completed");
  });
  it("não apresenta resposta truncada como sucesso", async () => {
    serve([{ aborted: true }]);
    expect((await inspect()).error?.code).toBe("NETWORK_ERROR");
  });
  it.each(["dns", "request"])("timeout total inclui %s", async (phase) => {
    vi.useFakeTimers();
    if (phase === "dns") mocks.lookup.mockReturnValue(new Promise(() => {}));
    else serve([{ hang: true }]);
    const pending = inspect();
    await vi.advanceTimersByTimeAsync(NETWORK_LIMITS.timeoutMs);
    expect(await pending).toMatchObject({
      status: "failed",
      error: { code: "TIMEOUT" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
