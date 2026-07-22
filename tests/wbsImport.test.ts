import { describe, expect, it } from "vitest";
import {
  applyWbsV20CodeCorrections,
  getGateRuleForCode,
  shiftWbsV20FollowUpTaskCode,
  WBS_GATE_RULES,
  WBS_TEMPLATE_SHEETS,
} from "@/lib/wbs/constants";
import { normalizeExcelCode, parseWbsTemplateRows } from "@/lib/wbs/import";
import type { WbsTemplateRow } from "@/lib/wbs/types";

function row(input: Partial<WbsTemplateRow> & Pick<WbsTemplateRow, "stage" | "sheetName" | "rowNumber">): WbsTemplateRow {
  return {
    role: "项目经理",
    packageCode: null,
    taskCode: null,
    parentCode: null,
    title: "测试节点",
    description: "",
    projectScopeLabel: "ALL",
    projectScope: "all",
    processSupport: "",
    deliverableSpec: "",
    ...input,
  };
}

describe("WBS template STR mapping", () => {
  it("maps the six fixed code ranges and keeps 2.10 as a string", () => {
    expect(normalizeExcelCode(2.1, "2.10")).toBe("2.10");
    expect(WBS_TEMPLATE_SHEETS).toEqual(["01-概念阶段", "02-计划阶段", "03-开发验证阶段"]);
    const boundaries = [
      ["1.1", "1.10", "1.11", "STR1"],
      ["2.1", "2.6", "2.7", "STR2"],
      ["2.8", "2.10", "2.11", "STR3"],
      ["3.1", "3.9", "3.10", "STR4"],
      ["3.11", "3.17", "3.18", "STR4A"],
      ["3.19", "3.20", "3.21", "STR5"],
    ] as const;
    for (const [start, end, review, gateKey] of boundaries) {
      expect(getGateRuleForCode(start)?.gateKey).toBe(gateKey);
      expect(getGateRuleForCode(end)?.gateKey).toBe(gateKey);
      expect(getGateRuleForCode(review)?.gateKey).toBe(gateKey);
    }
    expect(WBS_GATE_RULES).toHaveLength(6);
  });

  it("applies the confirmed V2.0 numbering corrections in memory", () => {
    const cases = [
      ["输出影像需求PD", "taskCode", "1.5.2", "1.5.3"],
      ["输出粉丝试用报告", "taskCode", "3.13.2", "3.12.2"],
      ["分析与优化粉丝问题", "taskCode", "3.13.3", "3.12.3"],
      ["IR主观体验验收", "taskCode", "3.12.1", "3.13.1"],
      ["进行项目认证", "packageCode", "3.15", "3.16"],
      ["发布产品营销材料", "packageCode", "3.16", "3.17"],
      ["STR4A评审", "packageCode", "3.17", "3.18"],
      ["调研与改善Beta用户NPS", "packageCode", "3.18", "3.19"],
    ] as const;
    for (const [title, field, fromCode, toCode] of cases) {
      const corrected = applyWbsV20CodeCorrections({
        sheetName: field === "taskCode" && title.includes("影像") ? "01-概念阶段" : "03-开发验证阶段",
        title,
        packageCode: field === "packageCode" ? fromCode : null,
        taskCode: field === "taskCode" ? fromCode : null,
      });
      expect(corrected[field]).toBe(toCode);
      expect(corrected.applied).toHaveLength(1);
    }
    expect(shiftWbsV20FollowUpTaskCode("1.5.2")).toBeNull();
    expect(shiftWbsV20FollowUpTaskCode("1.5.3")).toBe("1.5.4");
    expect(shiftWbsV20FollowUpTaskCode("1.5.13")).toBe("1.5.14");
  });

  it("creates package, task, and review gate nodes from two-level rows", () => {
    const result = parseWbsTemplateRows([
      row({ sheetName: "01-概念阶段", rowNumber: 2, stage: "concept", packageCode: "1.1" }),
      row({ sheetName: "01-概念阶段", rowNumber: 3, stage: "concept", taskCode: "1.1.1", parentCode: "1.1" }),
      row({ sheetName: "01-概念阶段", rowNumber: 4, stage: "concept", packageCode: "1.11", title: "STR1评审" }),
    ]);

    expect(result.nodes.map((node) => node.kind)).toEqual(["package", "task", "gate"]);
    expect(result.nodes.map((node) => node.gateKey)).toEqual(["STR1", "STR1", "STR1"]);
    expect(result.issues).toHaveLength(0);
  });

  it("requires a role only on second-level execution tasks", () => {
    const result = parseWbsTemplateRows([
      row({ sheetName: "01-概念阶段", rowNumber: 2, stage: "concept", packageCode: "1.1", role: "" }),
      row({ sheetName: "01-概念阶段", rowNumber: 3, stage: "concept", taskCode: "1.1.1", parentCode: "1.1", role: "" }),
      row({ sheetName: "01-概念阶段", rowNumber: 4, stage: "concept", packageCode: "1.11", title: "STR1评审", role: "" }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toEqual(["missing-role"]);
  });

  it("rejects an unknown project scope instead of guessing", () => {
    const result = parseWbsTemplateRows([
      row({ sheetName: "01-概念阶段", rowNumber: 2, stage: "concept", packageCode: "1.1", projectScope: null, projectScopeLabel: "未知项目" }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toContain("unknown-project-scope");
  });
});
