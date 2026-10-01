import { describe, expect, it } from "vitest";
import {
  collectionRuleSchema,
  createCollectionSchema,
  createTagSchema,
  projectResourceReferenceSchema,
  stableSlug,
} from "@/modules/workspace-intelligence/schemas";

describe("workspace intelligence schemas", () => {
  it("accepts a manual collection with conservative defaults", () => {
    expect(createCollectionSchema.parse({ name: "Lançamentos" })).toMatchObject({
      name: "Lançamentos",
      description: "",
      kind: "manual",
      rules: [],
    });
  });

  it("validates a smart collection rule", () => {
    expect(
      collectionRuleSchema.parse({
        field: "tag",
        operator: "contains",
        value: "prioridade",
      }),
    ).toMatchObject({ field: "tag", operator: "contains", value: "prioridade" });
    expect(() =>
      collectionRuleSchema.parse({
        field: "unknown",
        operator: "contains",
        value: "prioridade",
      }),
    ).toThrow();
    expect(() =>
      collectionRuleSchema.parse({
        field: "status",
        operator: "equals",
        value: "active",
      }),
    ).toThrow();
  });

  it("does not allow a Project to be connected to itself as a resource", () => {
    expect(
      projectResourceReferenceSchema.parse({
        resourceType: "campaign",
        resourceId: "campaign-1",
      }),
    ).toMatchObject({ resourceType: "campaign", resourceId: "campaign-1" });
    expect(() =>
      projectResourceReferenceSchema.parse({
        resourceType: "project",
        resourceId: "project-1",
      }),
    ).toThrow();
  });

  it("normalizes tag slugs and validates tag color", () => {
    expect(stableSlug("  Promoção VIP! ")).toBe("promocao-vip");
    expect(createTagSchema.parse({ name: "VIP" }).color).toBe("#285239");
    expect(() => createTagSchema.parse({ name: "VIP", color: "red" })).toThrow();
  });
});