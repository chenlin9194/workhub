import { describe, expect, it } from "vitest";
import { parseWbsTemplateRows } from "@/lib/wbs/import";
import type { WbsTemplateRow } from "@/lib/wbs/types";

const row = (overrides: Partial<WbsTemplateRow>): WbsTemplateRow => ({
  sheetName: "01-概念阶段",
  rowNumber: 1,
  stage: "concept",
  role: "项目经理",
  packageCode: null,
  taskCode: null,
  parentCode: null,
  title: "任务",
  description: "",
  projectScopeLabel: "仅整机项目",
  projectScope: "all",
  processSupport: "",
  deliverableSpec: "",
  ...overrides,
});

describe("WBS universal task set", () => {
  it("keeps every parsed node applicable to all projects", () => {
    const result = parseWbsTemplateRows([
      row({ rowNumber: 1, packageCode: "1.1" }),
      row({ rowNumber: 2, taskCode: "1.1.1", parentCode: "1.1" }),
      row({ rowNumber: 3, packageCode: "1.11", title: "STR1评审" }),
    ]);

    expect(result.issues).toHaveLength(0);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.every((node) => node.projectScope === "all")).toBe(true);
  });

  it("does not reject a legacy or unknown project category column", () => {
    const result = parseWbsTemplateRows([
      row({ rowNumber: 1, packageCode: "1.1", projectScopeLabel: "历史项目分类" }),
    ]);

    expect(result.issues.map((issue) => issue.code)).not.toContain("unknown-project-scope");
  });
});
