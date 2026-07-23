import { describe, expect, it } from "vitest";
import { generateProjectSnapshotMarkdown, generateRangeMarkdown, generateTodayMarkdown } from "@/lib/export";

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

  it("uses the related project name in today and range Markdown and quality checks", () => {
    const log = {
      id: "log-1",
      title: "项目进展",
      workDate: "2026-07-20",
      type: "note",
      source: "manual",
      project: "旧项目名",
      projectRef: { name: "新项目名" },
      content: "已完成同步",
    };

    const todayMarkdown = generateTodayMarkdown({
      today: "2026-07-20",
      workLogs: [log],
      closedItems: [],
      updatedItems: [],
      openHighPriorityItems: [],
      dueTodayItems: [],
      overdueItems: [],
      riskAndBlockerLogs: [],
      decisionLogs: [],
    });
    const rangeMarkdown = generateRangeMarkdown({
      start: "2026-07-20",
      end: "2026-07-20",
      workLogs: [log],
      closedItems: [],
      updatedItems: [],
    });

    expect(todayMarkdown).toContain("项目: 新项目名");
    expect(rangeMarkdown).toContain("项目: 新项目名");
    expect(todayMarkdown).not.toContain("项目: 旧项目名");
    expect(rangeMarkdown).not.toContain("项目: 旧项目名");
    expect(todayMarkdown).toContain("日志项目/模块 1/1");
    expect(rangeMarkdown).toContain("日志项目/模块 1/1");
  });
});
