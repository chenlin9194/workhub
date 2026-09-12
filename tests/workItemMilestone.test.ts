import { describe, expect, it } from "vitest";
import { resolveMilestoneOnProjectChange, validateWorkItemMilestone } from "@/lib/workItemMilestone";
import { getMilestonePhase, selectCurrentAndNextMilestones } from "@/lib/projectMilestoneView";

describe("WorkItem STR association", () => {
  it("accepts a milestone owned by the selected project", () => {
    expect(validateWorkItemMilestone("p1", "m1", { projectId: "p1" })).toBeNull();
  });

  it("rejects a cross-project milestone and projectless association", () => {
    expect(validateWorkItemMilestone("p1", "m1", { projectId: "p2" })).toBe("事项只能关联所属项目的 STR");
    expect(validateWorkItemMilestone(null, "m1", { projectId: "p1" })).toBe("关联 STR 前必须先选择项目");
  });

  it("keeps null as the legal project-level value and clears on project switch", () => {
    expect(validateWorkItemMilestone("p1", null, null)).toBeNull();
    expect(resolveMilestoneOnProjectChange({ projectId: "p2", milestoneId: "m1", milestoneProjectId: "p1" })).toBeNull();
    expect(resolveMilestoneOnProjectChange({ projectId: "p1", milestoneId: "m1", milestoneProjectId: "p1" })).toBe("m1");
  });
});

describe("Project STR cockpit selection", () => {
  const milestones = [
    { id: "future", title: "下一阶段", status: "planned", sortOrder: 2, plannedStartDate: "2026-09-20", plannedEndDate: "2026-09-25" },
    { id: "current", title: "当前阶段", status: "planned", sortOrder: 1, plannedStartDate: "2026-09-01", plannedEndDate: "2026-09-15" },
  ];

  it("derives current and next deterministically from real status and dates", () => {
    expect(getMilestonePhase(milestones[1], "2026-09-10")).toBe("current");
    expect(selectCurrentAndNextMilestones(milestones, "2026-09-10")).toMatchObject({ current: { id: "current" }, next: { id: "future" } });
  });
});
