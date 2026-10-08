import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ssrf from "@/modules/validation/ssrf";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(ssrf.internals, "resolveHostname");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SSRF protection", () => {
  it("rejects non-http/https protocols", async () => {
    const result = await ssrf.validateDestinationUrl("javascript:alert(1)");
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("INVALID_PROTOCOL");
  });

  it("rejects metadata endpoints", async () => {
    const result = await ssrf.validateDestinationUrl("http://metadata.google.internal");
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("METADATA_ENDPOINT");
  });

  it("rejects private IPv4 addresses", async () => {
    vi.mocked(ssrf.internals.resolveHostname).mockResolvedValueOnce(["10.0.0.1"]);

    const result = await ssrf.validateDestinationUrl("http://internal.example.com");
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("PRIVATE_IP");
  });

  it("rejects loopback addresses", async () => {
    vi.mocked(ssrf.internals.resolveHostname).mockResolvedValueOnce(["127.0.0.1"]);

    const result = await ssrf.validateDestinationUrl("http://localhost");
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("PRIVATE_IP");
  });

  it("rejects metadata IP addresses", async () => {
    vi.mocked(ssrf.internals.resolveHostname).mockResolvedValueOnce(["169.254.169.254"]);

    const result = await ssrf.validateDestinationUrl("http://169.254.169.254");
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("METADATA_ENDPOINT");
  });

  it("allows public IPv4 addresses", async () => {
    vi.mocked(ssrf.internals.resolveHostname).mockResolvedValueOnce(["8.8.8.8"]);

    const result = await ssrf.validateDestinationUrl("http://google.com");
    expect(result.safe).toBe(true);
  });

  it("isPrivateIp detects IPv4 private ranges", () => {
    expect(ssrf.isPrivateIp("10.0.0.1")).toBe(true);
    expect(ssrf.isPrivateIp("172.16.0.1")).toBe(true);
    expect(ssrf.isPrivateIp("172.31.255.255")).toBe(true);
    expect(ssrf.isPrivateIp("192.168.1.1")).toBe(true);
    expect(ssrf.isPrivateIp("127.0.0.1")).toBe(true);
    expect(ssrf.isPrivateIp("169.254.0.1")).toBe(true);
    expect(ssrf.isPrivateIp("8.8.8.8")).toBe(false);
    expect(ssrf.isPrivateIp("1.1.1.1")).toBe(false);
  });

  it("isPrivateIp detects IPv6 private ranges", () => {
    expect(ssrf.isPrivateIp("::1")).toBe(true);
    expect(ssrf.isPrivateIp("fe80::1")).toBe(true);
    expect(ssrf.isPrivateIp("fc00::1")).toBe(true);
    expect(ssrf.isPrivateIp("2001:db8::1")).toBe(false);
  });
});