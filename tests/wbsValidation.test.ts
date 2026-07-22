import { describe, expect, it } from "vitest";
import { validateExecutionTransition, validateTemplateStructure } from "@/lib/wbs/validation";
import type { WbsTemplateNode } from "@/lib/wbs/types";

const node = (overrides: Partial<WbsTemplateNode>): WbsTemplateNode => ({
  sheetName: "01-概念阶段",
  rowNumber: 1,
  stage: "concept",
  gateKey: "STR1",
  kind: "package",
  code: "1.1",
  parentCode: null,
  title: "工作包",
  description: "",
  role: "项目经理",
  projectScope: "all",
  processSupport: "",
  deliverableSpec: "",
  sortOrder: 1,
  ...overrides,
});

describe("WBS structure and transition validation", () => {
  it("allows only package to task and rejects duplicate or third-level structures", () => {
    const issues = validateTemplateStructure([
      node({ rowNumber: 1, kind: "package", code: "1.1" }),
      node({ rowNumber: 2, kind: "task", code: "1.1.1", parentCode: "1.1" }),
      node({ rowNumber: 3, kind: "task", code: "1.1.1", parentCode: "1.1" }),
      node({ rowNumber: 4, kind: "task", code: "1.1.1.1", parentCode: "1.1" }),
      node({ rowNumber: 5, kind: "package", code: "1.2", parentCode: "1.1" }),
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate-code", "third-level-node", "root-node-parent"]),
    );
  });

  it("requires the STR review gate to be the final executable node", () => {
    const issues = validateTemplateStructure([
      node({ kind: "package", code: "1.1", sortOrder: 1 }),
      node({ kind: "task", code: "1.1.1", parentCode: "1.1", sortOrder: 2 }),
      node({ kind: "gate", code: "1.11", title: "STR1评审", sortOrder: 3 }),
      node({ kind: "task", code: "1.1.2", parentCode: "1.1", sortOrder: 4 }),
    ]);

    expect(issues.map((issue) => issue.code)).toContain("review-not-last");
  });

  it("enforces done, blocked, and waived reasons", () => {
    expect(
      validateExecutionTransition({ currentStatus: "in_progress", nextStatus: "done" }).errors,
    ).toContain("完成任务必须填写完成结论");
    expect(
      validateExecutionTransition({ currentStatus: "in_progress", nextStatus: "done", completionNote: "完成" , requiredDeliverables: [{ required: true, status: "pending" }] }).errors,
    ).toContain("必需交付物未全部交付，不能完成任务");
    expect(
      validateExecutionTransition({ currentStatus: "in_progress", nextStatus: "blocked" }).errors,
    ).toContain("阻塞任务必须填写阻塞原因");
    expect(
      validateExecutionTransition({ currentStatus: "in_progress", nextStatus: "waived" }).errors,
    ).toContain("豁免任务必须填写豁免原因");
  });

  it("supports reopening historical completed nodes without deleting history", () => {
    const result = validateExecutionTransition({ currentStatus: "done", nextStatus: "in_progress" });
    expect(result.ok).toBe(true);
    expect(result.shouldClearCompletedAt).toBe(true);
  });
});
