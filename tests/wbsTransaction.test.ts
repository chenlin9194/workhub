import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findNode: vi.fn(),
  updateNode: vi.fn(),
  updateManyNode: vi.fn(),
  findGateNodes: vi.fn(),
  findMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  findExecutionItem: vi.fn(),
  updateExecutionItem: vi.fn(),
  createWorkItem: vi.fn(),
  updateDeliverable: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    projectWbsNode: { findFirst: mocks.findNode },
    workItem: { create: mocks.createWorkItem },
  },
}));

import { removeWbsTask, splitWbsNodeIntoWorkItem, updateWbsNode } from "@/lib/wbs/service";

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
    milestone: { id: "milestone-1", status: "planned", targetDate: null, actualDate: null, actualEndDate: null },
    originWorkItems: [],
    removedAt: null,
    removalReason: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback({
    projectWbsNode: {
      findFirst: mocks.findNode,
      update: mocks.updateNode,
      updateMany: mocks.updateManyNode,
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
  it("updates the node, deliverables, and milestone without touching a STR WorkItem", async () => {
    const node = currentNode();
    mocks.findNode.mockResolvedValue(node);
    mocks.updateNode.mockResolvedValue({ ...node, status: "done", completionNote: "已完成" });
    mocks.findGateNodes.mockResolvedValue([
      { kind: "task", status: "done", deliverables: node.deliverables },
      { kind: "gate", status: "not_started", deliverables: [] },
    ]);
    mocks.findMilestone.mockResolvedValue(node.milestone);
    mocks.updateMilestone.mockResolvedValue({ ...node.milestone, status: "in_progress" });

    const result = await updateWbsNode("project-1", "node-task-1", {
      status: "done",
      completionNote: "已完成",
      deliverables: [{ id: "deliverable-1", status: "delivered" }],
    });

    expect(result.readiness.status).toBe("in_progress");
    expect(result.executionItem).toBeNull();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.updateNode).toHaveBeenCalledTimes(1);
    expect(mocks.updateDeliverable).toHaveBeenCalledTimes(1);
    expect(mocks.updateMilestone).toHaveBeenCalledTimes(1);
    expect(mocks.findExecutionItem).not.toHaveBeenCalled();
    expect(mocks.updateExecutionItem).not.toHaveBeenCalled();
  });

  it("keeps milestone actual dates synchronized when done and reopened", async () => {
    const doneNode = { ...currentNode(), status: "in_progress" };
    const reopenedNode = { ...currentNode(), status: "done", completionNote: "已完成" };
    const doneAt = new Date("2026-08-21T00:00:00.000Z");
    mocks.findNode.mockResolvedValueOnce(doneNode).mockResolvedValueOnce(reopenedNode);
    mocks.updateNode.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...reopenedNode, ...data }));
    mocks.findGateNodes
      .mockResolvedValueOnce([
        { kind: "task", status: "done", deliverables: doneNode.deliverables },
        { kind: "gate", status: "done", deliverables: [] },
      ])
      .mockResolvedValueOnce([
        { kind: "task", status: "in_progress", deliverables: doneNode.deliverables },
        { kind: "gate", status: "not_started", deliverables: [] },
      ]);
    const plannedMilestone = { ...doneNode.milestone, status: "planned" };
    const completedMilestone = { ...plannedMilestone, status: "done", actualDate: doneAt, actualEndDate: doneAt };
    mocks.findMilestone.mockResolvedValueOnce(plannedMilestone).mockResolvedValueOnce(completedMilestone);
    mocks.updateMilestone.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...completedMilestone, ...data }));

    const completed = await updateWbsNode("project-1", doneNode.id, {
      status: "done",
      completionNote: "已完成",
      deliverables: [{ id: "deliverable-1", status: "delivered" }],
    });
    const reopened = await updateWbsNode("project-1", reopenedNode.id, { status: "in_progress" });

    expect(completed.milestone.actualDate).toEqual(expect.any(Date));
    expect(completed.milestone.actualEndDate).toEqual(completed.milestone.actualDate);
    expect(reopened.milestone.actualDate).toBeNull();
    expect(reopened.milestone.actualEndDate).toBeNull();
    expect(mocks.findExecutionItem).not.toHaveBeenCalled();
    expect(mocks.updateExecutionItem).not.toHaveBeenCalled();
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

  it.each([
    ["in_progress", "in_progress"],
    ["blocked", "open"],
    ["done", "open"],
  ] as const)("soft removes a %s task and recomputes active-node readiness", async (status, expectedReadiness) => {
    const node = { ...currentNode(), status, originWorkItems: [{ id: "item-linked", title: "关联事项", status: "open" }] };
    mocks.findNode.mockResolvedValue(node);
    mocks.updateManyNode.mockResolvedValue({ count: 1 });
    mocks.findGateNodes.mockResolvedValue([
      { kind: "task", status: status === "in_progress" ? "in_progress" : "not_started", deliverables: [] },
      { kind: "gate", status: "not_started", deliverables: [] },
    ]);
    mocks.findMilestone.mockResolvedValue({ ...node.milestone, status: status === "done" ? "done" : "in_progress", actualDate: status === "done" ? new Date("2026-08-20") : null });
    mocks.updateMilestone.mockResolvedValue({ ...node.milestone, status: "planned", actualDate: null });

    const result = await removeWbsTask("project-1", node.id, "业务范围调整");

    expect(result.idempotent).toBe(false);
    expect(result.node.removedAt).toBeInstanceOf(Date);
    expect(result.node.removalReason).toBe("业务范围调整");
    expect(result.readiness?.status).toBe(expectedReadiness);
    expect(result.warnings[0]).toContain("关联普通事项保留不变");
    expect(mocks.findGateNodes).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ removedAt: null }),
    }));
    expect(mocks.updateManyNode).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: node.id, projectId: "project-1", removedAt: null },
      data: expect.objectContaining({ removalReason: "业务范围调整" }),
    }));
    expect(mocks.updateNode).not.toHaveBeenCalled();
    expect(mocks.updateDeliverable).not.toHaveBeenCalled();
  });

  it("rejects package and gate removal without issuing writes", async () => {
    mocks.findNode.mockResolvedValue({ ...currentNode(), kind: "package", status: null });

    await expect(removeWbsTask("project-1", "node-package-1", "不再适用"))
      .rejects.toThrow("只有 WBS 执行任务可以软移除");

    expect(mocks.updateManyNode).not.toHaveBeenCalled();
    expect(mocks.updateMilestone).not.toHaveBeenCalled();
  });

  it("requires a non-empty removal reason", async () => {
    await expect(removeWbsTask("project-1", "node-task-1", "  "))
      .rejects.toThrow("移除原因不能为空");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns the original removal on a conditional race without a second mutation", async () => {
    const removedAt = new Date("2026-08-24T09:00:00.000Z");
    const node = { ...currentNode(), removedAt, removalReason: "原始原因" };
    mocks.findNode.mockResolvedValueOnce({ ...node, removedAt: null, removalReason: null }).mockResolvedValueOnce(node);
    mocks.updateManyNode.mockResolvedValue({ count: 0 });

    const result = await removeWbsTask("project-1", node.id, "新原因");

    expect(result.idempotent).toBe(true);
    expect(result.node.removedAt).toBe(removedAt);
    expect(result.node.removalReason).toBe("原始原因");
    expect(mocks.updateManyNode).toHaveBeenCalledTimes(1);
    expect(mocks.findGateNodes).not.toHaveBeenCalled();
    expect(mocks.updateMilestone).not.toHaveBeenCalled();
    expect(mocks.findExecutionItem).not.toHaveBeenCalled();
    expect(mocks.updateExecutionItem).not.toHaveBeenCalled();
  });

  it("does not patch or split an already removed node", async () => {
    mocks.findNode.mockResolvedValue(null);

    await expect(updateWbsNode("project-1", "node-task-1", { status: "done" }))
      .rejects.toThrow("WBS 节点不存在");
    await expect(splitWbsNodeIntoWorkItem("project-1", "node-task-1", { title: "拆分" }))
      .rejects.toThrow("WBS 节点不存在");
  });

  it("still splits a task node into a normal WorkItem with its WBS origin", async () => {
    const node = {
      ...currentNode(),
      project: { name: "项目 A" },
      originWorkItems: [],
    };
    mocks.findNode.mockResolvedValue(node);
    mocks.createWorkItem.mockResolvedValue({ id: "split-item" });

    await splitWbsNodeIntoWorkItem("project-1", node.id, { title: "拆分事项" });

    expect(mocks.createWorkItem).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "拆分事项",
        projectId: "project-1",
        sourceSystem: "wbs",
        originWbsNodeId: node.id,
      }),
    });
    expect(mocks.createWorkItem.mock.calls[0][0].data).not.toHaveProperty("executionMilestoneId");
  });
});
