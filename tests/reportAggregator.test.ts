import { describe, expect, it } from "vitest";
import { buildReportAggregate, isLegacySystemLog, isWbsGateExecutionItem, type ReportSourceProject } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";

const source: ReportSourceProject[] = [
  {
    id: "project-1", name: "项目一", code: "P1", status: "active", health: "green", owner: "项目负责人", pm: "PM", description: null,
    logs: [{ id: "project-log", workDate: "2026-09-10", title: "项目层记录", content: "项目完成同步", note: null, type: "note", source: "manual", projectId: "project-1", createdAt: "2026-09-10T08:00:00.000Z" }],
    milestones: [
      { id: "str-1", title: "STR1 交付", gateKey: "STR1", status: "in_progress", targetDate: "2026-09-30", actualDate: null, actualEndDate: null },
    ],
    items: [
      {
        id: "item-1", title: "主事项", description: null, type: "action", priority: "P1", status: "open", owner: "事项负责人", dueDate: "2026-09-20", health: "green", currentSummary: "推进中", nextAction: "继续验证", milestoneId: "str-1", managedBy: null, executionMilestoneId: null, originWbsNode: null,
        logs: [
          { id: "log-1", workDate: "2026-09-09", title: "事项进展", content: "完成接口联调", note: "完成接口联调", type: "note", source: "manual", projectId: "project-1", itemId: "item-1", createdAt: "2026-09-09T08:00:00.000Z" },
          { id: "log-system", workDate: "2026-09-10", title: "事项变化：状态更新", content: "open -> in_progress", note: null, type: "update", source: "system", projectId: "project-1", itemId: "item-1", createdAt: "2026-09-10T09:00:00.000Z" },
          { id: "log-progress", workDate: "2026-09-10", title: "Action progress", content: "接口验证通过", note: "接口验证通过", type: "note", source: "manual", projectId: "project-1", itemId: "item-1", actionItemId: "action-1", createdAt: "2026-09-10T10:00:00.000Z" },
          { id: "log-outside", workDate: "2026-09-01", title: "早期记录", content: "早期事实", note: null, type: "note", source: "manual", projectId: "project-1", itemId: "item-1", createdAt: "2026-09-01T10:00:00.000Z" },
        ],
        actionItems: [
          {
            id: "action-1", title: "接口验证", status: "pending", owner: "行动负责人", dueDate: "2026-09-18", doneAt: null,
            progressLogs: [
              { id: "log-progress", workDate: "2026-09-10", title: "Action progress", content: "接口验证通过", note: "接口验证通过", type: "note", source: "manual", projectId: "project-1", itemId: "item-1", actionItemId: "action-1", createdAt: "2026-09-10T10:00:00.000Z" },
              { id: "log-reschedule", workDate: "2026-09-11", title: "计划调整：2026-09-10 → 2026-09-18", content: "原因：等待依赖\n下一步：完成验证", note: "计划调整：2026-09-10 → 2026-09-18\n原因：等待依赖\n下一步：完成验证", type: "note", source: "manual", projectId: "project-1", itemId: "item-1", actionItemId: "action-1", createdAt: "2026-09-11T10:00:00.000Z" },
            ],
          },
          {
            id: "action-2", title: "已完成行动", status: "done", owner: "完成负责人", dueDate: "2026-09-08", doneAt: "2026-09-10T11:00:00.000Z",
            progressLogs: [{ id: "log-complete", workDate: "2026-09-10", title: "完成结果", content: "已采取行动并验证", note: "已采取行动并验证", type: "note", source: "manual", projectId: "project-1", itemId: "item-1", actionItemId: "action-2", createdAt: "2026-09-10T11:00:00.000Z" }],
          },
        ],
      },
      {
        id: "item-project-level", title: "项目级事项", description: null, type: "action", priority: "P2", status: "open", owner: null, dueDate: null, health: "unknown", currentSummary: null, nextAction: null, milestoneId: null, managedBy: null, executionMilestoneId: null, originWbsNode: null,
        logs: [{ id: "log-project-level", workDate: "2026-09-10", title: "项目级事实", content: "未归属 STR 的真实记录", note: null, type: "note", source: "manual", projectId: "project-1", itemId: "item-project-level", createdAt: "2026-09-10T12:00:00.000Z" }],
        actionItems: [],
      },
      {
        id: "fake-gate", title: "[STR1] 节点准备与评审", description: null, type: "action", priority: "P2", status: "open", owner: null, dueDate: null, health: "unknown", currentSummary: null, nextAction: null, milestoneId: "str-1", managedBy: "wbs", executionMilestoneId: "execution-1", originWbsNode: { kind: "gate" },
        logs: [{ id: "fake-log", workDate: "2026-09-10", title: "fake", content: "fake", note: null, type: "note", source: "system", projectId: "project-1", itemId: "fake-gate", createdAt: "2026-09-10T12:00:00.000Z" }], actionItems: [],
      },
    ],
  },
  {
    id: "project-2", name: "项目二", code: "P2", status: "active", health: "yellow", owner: null, pm: null, description: null, logs: [], milestones: [],
    items: [{ id: "item-2", title: "另一个项目事项", description: null, type: "action", priority: "P2", status: "open", owner: null, dueDate: null, health: "yellow", currentSummary: null, nextAction: null, milestoneId: null, managedBy: null, executionMilestoneId: null, originWbsNode: null, logs: [{ id: "log-p2", workDate: "2026-09-10", title: "项目二记录", content: "项目二事实", note: null, type: "note", source: "manual", projectId: "project-2", itemId: "item-2", createdAt: "2026-09-10T12:00:00.000Z", reportable: false }], actionItems: [] }],
  },
];

describe("Phase 4 report aggregator", () => {
  const input = { startDate: "2026-09-09", endDate: "2026-09-11" };

  it("builds project → STR → item → action → log hierarchy without title inference", () => {
    const report = buildReportAggregate(input, source);
    expect(report.projects.map((project) => project.id)).toEqual(["project-1", "project-2"]);
    expect(report.projects[0].milestones[0].workItems.map((item) => item.id)).toEqual(["item-1"]);
    expect(report.projects[0].projectItems.map((item) => item.id)).toEqual(["item-project-level"]);
    expect(report.projects[0].milestones[0].workItems[0].actionItems.map((action) => action.id)).toEqual(["action-1", "action-2"]);
    expect(report.projects[0].milestones[0].workItems[0].itemLogs.map((log) => log.id)).toEqual(["log-system", "log-1"]);
  });

  it("deduplicates logs that are reachable from both itemId and actionItemId", () => {
    const report = buildReportAggregate(input, source);
    const action = report.projects[0].milestones[0].workItems[0].actionItems[0];
    expect(action.logs.map((log) => log.id)).toEqual(["log-reschedule", "log-progress"]);
    expect(report.summary.logs).toBe(8);
  });

  it("includes completion, open context, reschedule facts, legacy logs, and reportable=false facts", () => {
    const report = buildReportAggregate(input, source);
    const item = report.projects[0].milestones[0].workItems[0];
    expect(item.actionItems.find((action) => action.id === "action-2")?.completedInRange).toBe(true);
    expect(item.actionItems.find((action) => action.id === "action-1")?.logs.find((log) => log.id === "log-reschedule")?.note).toContain("原因：等待依赖");
    expect(item.itemLogs.filter((log) => !log.isSystemLog)).toHaveLength(1);
    expect(item.itemLogs.find((log) => log.isSystemLog)?.id).toBe("log-system");
    expect(report.projects[1].projectItems[0].itemLogs[0].id).toBe("log-p2");
    expect(report.summary.systemLogs).toBe(1);
  });

  it("keeps different STRs separate and includes an open action without a period log", () => {
    const secondStr = { id: "str-2", title: "STR2 验收", gateKey: "STR2", status: "planned", targetDate: "2026-10-01", actualDate: null, actualEndDate: null };
    const secondItem = {
      id: "item-second-str", title: "STR2 事项", description: null, type: "action", priority: "P2", status: "open", owner: null, dueDate: null, health: "unknown", currentSummary: null, nextAction: null, milestoneId: "str-2", managedBy: null, executionMilestoneId: null, originWbsNode: null,
      logs: [],
      actionItems: [{ id: "action-open-no-log", title: "等待下一次确认", status: "pending", owner: "确认人", dueDate: "2026-09-30", doneAt: null, progressLogs: [] }],
    };
    const expanded = [{ ...source[0], milestones: [...source[0].milestones, secondStr], items: [...source[0].items, secondItem] }, source[1]];
    const report = buildReportAggregate(input, expanded);
    expect(report.projects[0].milestones.map((milestone) => milestone.id)).toEqual(["str-1", "str-2"]);
    expect(report.projects[0].milestones[1].workItems[0].actionItems[0].id).toBe("action-open-no-log");
  });

  it("applies an exact project filter without reassigning project-less facts", () => {
    const report = buildReportAggregate({ ...input, projectId: "project-2" }, source);
    expect(report.projects.map((project) => project.id)).toEqual(["project-2"]);
    expect(report.projects[0].projectItems[0].itemLogs[0].id).toBe("log-p2");
  });

  it("uses the same aggregate for Markdown and date-window variants", () => {
    const report = buildReportAggregate(input, source);
    const markdown = generateReportMarkdown(report);
    expect(markdown).toContain("项目：项目一");
    expect(markdown).toContain("STR/里程碑：STR1 交付");
    expect(markdown).toContain("计划调整：2026-09-10 → 2026-09-18");
    expect(markdown).not.toContain("事项变化：状态更新");
    expect(buildReportAggregate({ startDate: "2026-09-10", endDate: "2026-09-10" }, source).startDate).toBe("2026-09-10");
    expect(buildReportAggregate({ startDate: "2026-09-09", endDate: "2026-09-15" }, source).endDate).toBe("2026-09-15");
  });

  it("has deterministic system/fake WBS classification", () => {
    expect(isLegacySystemLog({ title: "事项变化：状态更新", actionItemId: null })).toBe(true);
    expect(isLegacySystemLog({ title: "事项变化：进展", actionItemId: "action-1" })).toBe(false);
    expect(isWbsGateExecutionItem({ managedBy: "wbs", executionMilestoneId: "x", originWbsNode: { kind: "gate" } })).toBe(true);
    expect(buildReportAggregate(input, source).summary.workItems).toBe(3);
  });
});
