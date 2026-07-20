import { describe, expect, it } from "vitest";
import { buildItemsLink, buildLogsLink } from "@/lib/filterLinks";

describe("filter links", () => {
  it("prefers a project id to a legacy project name", () => {
    expect(buildItemsLink({ projectId: "p-1", project: "不应写入", priority: ["P0", "P1"] }))
      .toBe("/items?projectId=p-1&priority=P0%2CP1");
  });

  it("keeps explicit false log filters", () => {
    expect(buildLogsLink({ projectId: "p-1", reportable: false, hasItem: "false" }))
      .toBe("/logs?projectId=p-1&hasItem=false&reportable=false");
  });
});
