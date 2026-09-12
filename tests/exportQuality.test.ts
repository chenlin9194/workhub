import { describe, expect, it } from "vitest";
import { generateProjectSnapshotMarkdown } from "@/lib/export";

describe("project snapshot Markdown compatibility", () => {
  it("keeps project snapshot quality reminders independent from Phase 4 report aggregation", () => {
    const markdown = generateProjectSnapshotMarkdown({
      projectId: "project-1",
      projectName: "项目 A",
      project: { id: "project-1", name: "项目 A", type: "project", status: "active", health: "green", currentSummary: "推进中", nextMilestone: "待排期", nextAction: "确认负责人" },
      items: [],
      recentLogs: [],
      milestones: [],
      links: [],
    });
    expect(markdown).toContain("管理提醒");
    expect(markdown).toContain("尚无结构化里程碑或计划节点");
  });
});
