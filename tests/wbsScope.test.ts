import { describe, expect, it } from "vitest";
import { isScopeApplicable } from "@/lib/wbs/constants";
import { filterWbsNodesForProfile } from "@/lib/wbs/import";
import type { WbsTemplateNode } from "@/lib/wbs/types";

const base = (overrides: Partial<WbsTemplateNode>): WbsTemplateNode => ({
  sheetName: "01-概念阶段",
  rowNumber: 1,
  stage: "concept",
  gateKey: "STR1",
  kind: "task",
  code: "1.1.1",
  parentCode: "1.1",
  title: "任务",
  description: "",
  role: "项目经理",
  projectScope: "all",
  processSupport: "",
  deliverableSpec: "",
  sortOrder: 1,
  ...overrides,
});

describe("WBS project scope", () => {
  it("uses the fixed ALL/tOS/tOS-major/device applicability matrix", () => {
    expect(isScopeApplicable("all", "tos")).toBe(true);
    expect(isScopeApplicable("tos", "tos_major")).toBe(true);
    expect(isScopeApplicable("tos_major", "tos")).toBe(false);
    expect(isScopeApplicable("device", "tos")).toBe(false);
    expect(isScopeApplicable("device", "device")).toBe(true);
  });

  it("keeps a package when an applicable child remains", () => {
    const nodes = [
      base({ kind: "package", code: "1.1", parentCode: null, projectScope: "device" }),
      base({ code: "1.1.1", projectScope: "tos" }),
      base({ code: "1.1.2", projectScope: "device" }),
    ];
    const tosNodes = filterWbsNodesForProfile(nodes, "tos");
    const tosMajorNodes = filterWbsNodesForProfile(nodes, "tos_major");
    const deviceNodes = filterWbsNodesForProfile(nodes, "device");
    expect(tosNodes.map((node) => node.code)).toEqual(["1.1.1"]);
    expect(tosMajorNodes.map((node) => node.code)).toEqual(["1.1.1"]);
    expect(deviceNodes.map((node) => node.code)).toEqual(["1.1", "1.1.2"]);
  });
});
