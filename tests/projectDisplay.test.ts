import { describe, expect, it } from "vitest";
import { getOptionalProjectDisplayName, getProjectDisplayName } from "@/lib/projectDisplay";

describe("project display source priority", () => {
  it("prefers the related project name over the legacy string", () => {
    expect(getProjectDisplayName({ relationName: "新项目名", legacyName: "旧项目名" })).toBe("新项目名");
  });

  it("falls back to the legacy project string when no relation exists", () => {
    expect(getProjectDisplayName({ legacyName: "历史项目" })).toBe("历史项目");
  });

  it("uses an explicit unassociated label when both values are empty", () => {
    expect(getProjectDisplayName({})).toBe("未关联项目");
  });

  it("returns null for an unassociated project when export quality needs an optional name", () => {
    expect(getOptionalProjectDisplayName({})).toBeNull();
    expect(getOptionalProjectDisplayName({ relationName: "新项目名", legacyName: "旧项目名" })).toBe("新项目名");
  });
});
