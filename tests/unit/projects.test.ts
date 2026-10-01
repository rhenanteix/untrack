import { describe, expect, it } from "vitest";
import {
  bulkProjectActionSchema,
  createProjectSchema,
  projectListQuerySchema,
  projectSlug,
  projectStatusSchema,
} from "@/modules/projects/schemas";

describe("project schemas", () => {
  it("accepts a small project form with helpful defaults", () => {
    expect(createProjectSchema.parse({ name: "Black Friday" })).toEqual({
      name: "Black Friday",
      description: "",
      icon: "folder",
      color: "#285239",
    });
  });

  it("rejects unsupported fields and invalid colors", () => {
    expect(() =>
      createProjectSchema.parse({ name: "Black Friday", ownerId: "other" }),
    ).toThrow();
    expect(() =>
      createProjectSchema.parse({ name: "Black Friday", color: "green" }),
    ).toThrow();
  });

  it("normalizes a durable ASCII slug", () => {
    expect(projectSlug("  Promoção de Verão 2026! ")).toBe(
      "promocao-de-verao-2026",
    );
    expect(projectSlug("---")).toBe("project");
  });

  it("parses project list filters and statuses", () => {
    expect(projectListQuerySchema.parse({})).toMatchObject({
      search: "",
      status: "active",
      page: 1,
    });
    expect(projectStatusSchema.parse("archived")).toBe("archived");
    expect(() => projectStatusSchema.parse("deleted")).toThrow();
  });

  it("validates bounded, explicit bulk lifecycle actions", () => {
    expect(
      bulkProjectActionSchema.parse({ action: "archive", ids: ["project-1"] }),
    ).toMatchObject({ action: "archive", ids: ["project-1"] });
    expect(() =>
      bulkProjectActionSchema.parse({ action: "delete", ids: ["project-1"] }),
    ).toThrow();
    expect(() =>
      bulkProjectActionSchema.parse({ action: "archive", ids: [] }),
    ).toThrow();
  });
});