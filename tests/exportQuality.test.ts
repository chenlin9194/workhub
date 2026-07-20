import { describe, expect, it } from "vitest";
import { generateProjectSnapshotMarkdown, generateTodayMarkdown } from "@/lib/export";

describe("fact package quality wording", () => {
  it("separates field completeness from an unlogged P0/P1 follow-up reminder", () => {
    const markdown = generateTodayMarkdown({
      today: "2026-07-20",
      workLogs: [],
      closedItems: [],
      updatedItems: [],
      openHighPriorityItems: [{ id: "item-1", title: "关键发布", type: "action", priority: "P0", status: "open" }],
      dueTodayItems: [],
      overdueItems: [],
      riskAndBlockerLogs: [],
      decisionLogs: [],
    });

    expect(markdown).toContain("跟进提醒");
    expect(markdown).toContain("当日无日志");
    expect(markdown).not.toContain("暂无明显缺口");
  });

  it("marks an active project with no structured milestone as a management reminder", () => {
    const markdown = generateProjectSnapshotMarkdown({
      projectId: "project-1",
      projectName: "项目 A",
      project: {
        id: "project-1",
        name: "项目 A",
        type: "project",
        status: "active",
        health: "green",
        currentSummary: "推进中",
        nextMilestone: "待排期",
        nextAction: "确认负责人",
      },
      items: [],
      recentLogs: [],
      milestones: [],
      links: [],
    });

    expect(markdown).toContain("管理提醒");
    expect(markdown).toContain("尚无结构化里程碑或计划节点");
    expect(markdown).not.toContain("暂无明显缺口");
  });
});
