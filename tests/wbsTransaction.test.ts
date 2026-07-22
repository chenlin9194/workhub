import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findNode: vi.fn(),
  updateNode: vi.fn(),
  findGateNodes: vi.fn(),
  findMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  findExecutionItem: vi.fn(),
  updateExecutionItem: vi.fn(),
  updateDeliverable: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { updateWbsNode } from "@/lib/wbs/service";

function currentNode() {
  return {
    id: "node-task-1",
    planId: "plan-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    gateKey: "STR1",
    kind: "task",
    status: "in_progress",
    completionNote: null,
    blockedReason: null,
    waiverReason: null,
    completedAt: null,
    internalCheckDate: null,
    deliverables: [{ id: "deliverable-1", required: true, status: "delivered", evidenceUrl: null, sortOrder: 0 }],
    milestone: { id: "milestone-1", status: "planned", targetDate: null, actualDate: null },
    originWorkItems: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback({
    projectWbsNode: {
      findFirst: mocks.findNode,
      update: mocks.updateNode,
      findMany: mocks.findGateNodes,
    },
    projectMilestone: {
      findUnique: mocks.findMilestone,
      update: mocks.updateMilestone,
    },
    workItem: {
      findUnique: mocks.findExecutionItem,
      update: mocks.updateExecutionItem,
    },
    projectWbsDeliverable: { update: mocks.updateDeliverable },
  }));
});

describe("WBS execution transactions", () => {
  it("updates the node, deliverables, milestone, and STR item through one transaction client", async () => {
    const node = currentNode();
    mocks.findNode.mockResolvedValue(node);
    mocks.updateNode.mockResolvedValue({ ...node, status: "done", completionNote: "已完成" });
    mocks.findGateNodes.mockResolvedValue([
      { kind: "task", status: "done", deliverables: node.deliverables },
      { kind: "gate", status: "not_started", deliverables: [] },
    ]);
    mocks.findMilestone.mockResolvedValue(node.milestone);
    mocks.updateMilestone.mockResolvedValue({ ...node.milestone, status: "in_progress" });
    mocks.findExecutionItem.mockResolvedValue({ id: "item-str1", status: "open", closedAt: null });
    mocks.updateExecutionItem.mockResolvedValue({ id: "item-str1", status: "following" });

    const result = await updateWbsNode("project-1", "node-task-1", {
      status: "done",
      completionNote: "已完成",
      deliverables: [{ id: "deliverable-1", status: "delivered" }],
    });

    expect(result.readiness.status).toBe("in_progress");
    expect(result.executionItem?.status).toBe("following");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.updateNode).toHaveBeenCalledTimes(1);
    expect(mocks.updateDeliverable).toHaveBeenCalledTimes(1);
    expect(mocks.updateMilestone).toHaveBeenCalledTimes(1);
    expect(mocks.updateExecutionItem).toHaveBeenCalledTimes(1);
  });

  it("rejects an incomplete done transition before issuing writes", async () => {
    mocks.findNode.mockResolvedValue(currentNode());

    await expect(updateWbsNode("project-1", "node-task-1", { status: "done" }))
      .rejects.toThrow("完成任务必须填写完成结论");

    expect(mocks.updateNode).not.toHaveBeenCalled();
    expect(mocks.updateDeliverable).not.toHaveBeenCalled();
    expect(mocks.updateMilestone).not.toHaveBeenCalled();
    expect(mocks.updateExecutionItem).not.toHaveBeenCalled();
  });
});
