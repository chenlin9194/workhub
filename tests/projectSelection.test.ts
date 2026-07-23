import { describe, expect, it } from "vitest";
import { resolveProjectSelection } from "@/lib/projectSelection";

describe("project selection state", () => {
  const projects = [
    { id: "project-1", name: "项目 A" },
    { id: "project-2", name: "项目 B" },
  ];

  it("clears both relation id and legacy name when the project is cleared", () => {
    expect(resolveProjectSelection("", projects)).toEqual({ projectId: "", project: "" });
  });

  it("keeps the selected project id and canonical name together", () => {
    expect(resolveProjectSelection("project-2", projects)).toEqual({ projectId: "project-2", project: "项目 B" });
  });
});
