import { describe, expect, it } from "vitest";
import { resolveWorkItemProjectUpdate } from "@/lib/workItemProject";

describe("WorkItem project update rules", () => {
  it("uses the resolved relation name when a project id is provided", () => {
    expect(resolveWorkItemProjectUpdate({
      currentProjectId: null,
      hasProjectId: true,
      requestedProjectId: "project-1",
      hasProject: true,
      requestedProjectName: "伪造名称",
      resolvedProjectName: "项目 A",
    })).toEqual({ projectId: "project-1", project: "项目 A" });
  });

  it("preserves the current relation name when only a legacy name is submitted", () => {
    expect(resolveWorkItemProjectUpdate({
      currentProjectId: "project-1",
      currentProjectName: "项目 A",
      hasProjectId: false,
      requestedProjectId: null,
      hasProject: true,
      requestedProjectName: "伪造名称",
    })).toEqual({ project: "项目 A" });
  });

  it("allows legacy project edits only when no relation exists", () => {
    expect(resolveWorkItemProjectUpdate({
      currentProjectId: null,
      hasProjectId: false,
      requestedProjectId: null,
      hasProject: true,
      requestedProjectName: "历史项目",
    })).toEqual({ project: "历史项目" });
  });

  it("keeps an explicit relation clear separate from legacy compatibility", () => {
    expect(resolveWorkItemProjectUpdate({
      currentProjectId: "project-1",
      currentProjectName: "项目 A",
      hasProjectId: true,
      requestedProjectId: null,
      hasProject: false,
      requestedProjectName: null,
    })).toEqual({ projectId: null, project: null });
  });
});
