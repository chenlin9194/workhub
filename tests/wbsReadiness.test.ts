import { describe, expect, it } from "vitest";
import { deriveMilestoneStatus, derivePackageStatus, deriveStrReadiness, deriveStrStatus } from "@/lib/wbs/readiness";
import type { WbsExecutionNodeState } from "@/lib/wbs/types";

const task = (status: WbsExecutionNodeState["status"], kind: WbsExecutionNodeState["kind"] = "task"): WbsExecutionNodeState => ({
  kind,
  status,
});

describe("WBS readiness derivation", () => {
  it("derives package and STR states from execution nodes", () => {
    expect(derivePackageStatus([task("not_started"), task("in_progress")])).toBe("in_progress");
    expect(derivePackageStatus([task("done"), task("waived")])).toBe("done");
    expect(deriveStrStatus([task("done"), task("blocked")])).toBe("blocked");
    expect(deriveStrStatus([task("done"), task("waived")])).toBe("closed");
  });

  it("keeps STR open until execution starts and prompts review after prerequisites", () => {
    expect(deriveStrStatus([task("not_started"), task("not_started", "gate")])).toBe("open");
    const readiness = deriveStrReadiness("STR1", [task("done"), task("not_started", "gate")]);
    expect(readiness.status).toBe("in_progress");
    expect(readiness.nextAction).toBe("组织 STR 评审");
  });

  it("derives delayed and completed milestone states", () => {
    expect(deriveMilestoneStatus([task("in_progress")], "2026-07-21", "2026-07-22")).toBe("delayed");
    expect(deriveMilestoneStatus([task("done")], "2026-07-21", "2026-07-22")).toBe("done");
  });
});
