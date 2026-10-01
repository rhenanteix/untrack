import { describe, expect, it } from "vitest";
import {
  dateFilter,
  libraryFilters,
} from "@/modules/workspaces/library-filters";

describe("library URL filters", () => {
  it("defaults to the first page and strips untrusted workspace claims", () => {
    expect(
      libraryFilters(new URL("https://example.com/?workspaceId=foreign")),
    ).toEqual({
      page: 1,
      search: "",
      status: "",
      clientId: "",
      campaignId: "",
    });
  });
  it.each([
    "page=0",
    "page=1.5",
    "page=10001",
    "from=2026-02-30",
    "from=2026-10-02&to=2026-10-01",
  ])("rejects invalid filters: %s", (query) => {
    expect(() =>
      libraryFilters(new URL(`https://example.com/?${query}`)),
    ).toThrow();
  });
  it("preserves Unicode and punctuation for literal database search", () => {
    expect(
      libraryFilters(
        new URL(
          "https://example.com/?search=%20São%20Paulo%20%26%20QR%20&page=2",
        ),
      ).search,
    ).toBe("São Paulo & QR");
  });
  it("uses inclusive UTC dates, including the last millisecond", () => {
    expect(dateFilter("2026-10-01", "2026-10-02")).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lte: new Date("2026-10-02T23:59:59.999Z"),
    });
    expect(dateFilter()).toBeUndefined();
  });
});
