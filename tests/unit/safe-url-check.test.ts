import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ default: { request: mocks.request } }));
vi.mock("node:https", () => ({ default: { request: mocks.request } }));

import { checkUrl } from "@/lib/safe-url-check";

function response(status: number, location?: string) {
  const stream = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
    resume: () => void;
  };
  stream.statusCode = status;
  stream.headers = {
    "content-type": "text/html",
    ...(location ? { location } : {}),
  };
  stream.resume = () => undefined;
  return stream;
}

describe("checkUrl: proteção SSRF", () => {
  beforeEach(() => {
    mocks.lookup.mockReset();
    mocks.request.mockReset();
    mocks.lookup.mockImplementation(async (hostname: string) => {
      const privateAddresses: Record<string, string> = {
        localhost: "127.0.0.1",
        "127.0.0.1": "127.0.0.1",
        "10.0.0.1": "10.0.0.1",
        "172.16.2.3": "172.16.2.3",
        "192.168.1.20": "192.168.1.20",
        "169.254.169.254": "169.254.169.254",
        "[::1]": "::1",
        "::1": "::1",
        "[fc00::1]": "fc00::1",
        "fc00::1": "fc00::1",
      };
      const address = privateAddresses[hostname] ?? "93.184.216.34";
      return [{ address, family: address.includes(":") ? 6 : 4 }];
    });
  });

  it.each([
    "ftp://public.test/file",
    "file:///etc/passwd",
    "http://user:password@public.test/",
  ])("bloqueia protocolo ou credenciais: %s", async (url) => {
    await expect(checkUrl(url)).rejects.toMatchObject({ code: "UNSAFE_URL" });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost/admin",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://172.16.2.3/",
    "http://192.168.1.20/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fc00::1]/",
  ])(
    "bloqueia destino local, privado, metadata ou IPv6 reservado: %s",
    async (url) => {
      await expect(checkUrl(url)).rejects.toMatchObject({ code: "UNSAFE_URL" });
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );

  it("bloqueia hostname com qualquer resposta DNS privada", async () => {
    mocks.lookup.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(checkUrl("https://mixed.test/")).rejects.toMatchObject({
      code: "UNSAFE_URL",
    });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("segue redirecionamento público sem rede externa real", async () => {
    mocks.request.mockImplementation(
      (
        options: { path: string },
        callback: (value: ReturnType<typeof response>) => void,
      ) => {
        const request = new EventEmitter() as EventEmitter & {
          setTimeout: () => void;
          end: () => void;
          destroy: (error: Error) => void;
        };
        request.setTimeout = () => undefined;
        request.destroy = (error) => request.emit("error", error);
        request.end = () =>
          callback(
            options.path === "/start"
              ? response(302, "https://public.test/final")
              : response(204),
          );
        return request;
      },
    );

    await expect(checkUrl("https://public.test/start")).resolves.toMatchObject({
      reachable: true,
      status: 204,
      finalUrl: "https://public.test/final",
      redirects: 1,
      method: "HEAD",
    });
  });

  it("revalida DNS e bloqueia redirect para metadata", async () => {
    mocks.request.mockImplementation(
      (
        _options: unknown,
        callback: (value: ReturnType<typeof response>) => void,
      ) => {
        const request = new EventEmitter() as EventEmitter & {
          setTimeout: () => void;
          end: () => void;
          destroy: (error: Error) => void;
        };
        request.setTimeout = () => undefined;
        request.destroy = (error) => request.emit("error", error);
        request.end = () =>
          callback(response(302, "http://169.254.169.254/latest/meta-data/"));
        return request;
      },
    );

    await expect(checkUrl("https://public.test/start")).rejects.toMatchObject({
      code: "UNSAFE_URL",
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});
