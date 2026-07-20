import { describe, expect, it } from "vitest";
import {
  normalizePage,
  optionalYmdDate,
  PRIORITY_VALUES,
  requireEnum,
  requireText,
} from "@/lib/inputValidation";

describe("core input validation", () => {
  it("trims required text and rejects whitespace-only values", () => {
    expect(requireText("  可执行事项  ", "标题").value).toBe("可执行事项");
    expect(requireText("   ", "标题").error).toBeDefined();
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(optionalYmdDate("2026-07-20", "日期").value).toBe("2026-07-20");
    expect(optionalYmdDate("2026-02-30", "日期").error).toBeDefined();
    expect(optionalYmdDate("20/07/2026", "日期").error).toBeDefined();
  });

  it("rejects unknown enum values and bounds pagination", () => {
    expect(requireEnum("P0", PRIORITY_VALUES, "优先级").value).toBe("P0");
    expect(requireEnum("urgent", PRIORITY_VALUES, "优先级").error).toBeDefined();
    expect(normalizePage("-5")).toBe(1);
    expect(normalizePage("999", 20, 100)).toBe(100);
  });
});
