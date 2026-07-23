import { describe, expect, it } from "vitest";
import { hasAdvancedItemFilters } from "@/lib/itemFilters";

describe("advanced item filter visibility", () => {
  it("opens when the URL contains an advanced filter", () => {
    expect(hasAdvancedItemFilters({ priority: "P0" })).toBe(true);
  });

  it("collapses when the URL has no advanced filter", () => {
    expect(hasAdvancedItemFilters({})).toBe(false);
  });
});
