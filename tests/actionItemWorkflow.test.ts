import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findAction: vi.fn(),
  updateAction: vi.fn(),
  createLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import {
  addActionItemProgressLog,
  buildActionItemProgressLogData,
  completeActionItem,
  rescheduleActionItem,
} from "@/lib/actionItemWorkflow";

const context = {
  id: "action-1",
  title: "PRD 剩余问题闭环",
  status: "pending",
  owner: "负责人",
  dueDate: "2026-09-10",
  sortOrder: 0,
  workItemId: "item-1",
  workLogId: null,
  projectId: "project-1",
  doneAt: null,
  doneNote: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  workItem: {
    id: "item-1",
    projectId: "project-1",
    project: "旧项目名",
    module: "需求",
    tags: "v3",
    sourceUrl: "https://example.com/item-1",
    projectRef: { name: "WorkHub" },
  },
};

function useTransactionClient() {
  mocks.transaction.mockImplementation(async (callback) => callback({
    actionItem: { findUnique: mocks.findAction, update: mocks.updateAction },
    workLog: { create: mocks.createLog },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useTransactionClient();
  mocks.findAction.mockResolvedValue({ ...context });
  mocks.updateAction.mockResolvedValue({ ...context, dueDate: "2026-09-20", status: "done" });
  mocks.createLog.mockResolvedValue({ id: "log-progress-1", itemId: "item-1", actionItemId: "action-1" });
});

describe("ActionItem V3 workflow", () => {
  it("writes progress logs to both the ActionItem and parent WorkItem without changing status", async () => {
    await addActionItemProgressLog("action-1", { workDate: "2026-09-12", note: "已完成接口核对" });

    expect(mocks.updateAction).not.toHaveBeenCalled();
    expect(mocks.createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workDate: "2026-09-12",
        note: "已完成接口核对",
        actionItemId: "action-1",
        itemId: "item-1",
        projectId: "project-1",
        reportable: false,
      }),
    });
  });

  it("preserves the complete note and legacy fields in the new log", () => {
    expect(buildActionItemProgressLogData(context, {
      workDate: "2026-09-12",
      note: "计划调整：2026-09-10 → 2026-09-20\n原因：等待评审\n下一步：周一确认",
      title: "计划调整：2026-09-10 → 2026-09-20",
      type: "update",
    })).toEqual(expect.objectContaining({
      title: "计划调整：2026-09-10 → 2026-09-20",
      content: "计划调整：2026-09-10 → 2026-09-20\n原因：等待评审\n下一步：周一确认",
      note: "计划调整：2026-09-10 → 2026-09-20\n原因：等待评审\n下一步：周一确认",
      type: "update",
      source: "manual",
      itemId: "item-1",
      actionItemId: "action-1",
    }));
  });

  it("atomically reschedules an overdue action and records reason plus next step", async () => {
    const result = await rescheduleActionItem("action-1", {
      dueDate: "2026-09-20",
      reason: "等待评审反馈",
      nextStep: "周一跟进确认",
    });

    expect(mocks.updateAction).toHaveBeenCalledWith({ where: { id: "action-1" }, data: { dueDate: "2026-09-20" } });
    expect(mocks.createLog).toHaveBeenCalledWith({ data: expect.objectContaining({
      note: "计划调整：2026-09-10 → 2026-09-20\n原因：等待评审反馈\n下一步：周一跟进确认",
      actionItemId: "action-1",
      itemId: "item-1",
    }) });
    expect(result.log).toBeTruthy();
  });

  it("rejects an overdue reschedule without both explanation fields", async () => {
    await expect(rescheduleActionItem("action-1", { dueDate: "2026-09-20", reason: "只有原因" }))
      .rejects.toThrow("逾期调整计划必须填写延期原因和下一步");
    expect(mocks.updateAction).not.toHaveBeenCalled();
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("completes an action and writes an optional completion log in the same transaction", async () => {
    const result = await completeActionItem("action-1", { completionNote: "已完成评审并同步结论" });

    expect(mocks.updateAction).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: { status: "done", doneAt: expect.any(Date), doneNote: "已完成评审并同步结论" },
    });
    expect(mocks.createLog).toHaveBeenCalledWith({ data: expect.objectContaining({
      note: "已完成评审并同步结论",
      actionItemId: "action-1",
      itemId: "item-1",
    }) });
    expect(result.actionItem.status).toBe("done");
  });

  it("propagates a log failure so the caller can roll back the transaction", async () => {
    mocks.createLog.mockRejectedValue(new Error("log write failed"));
    await expect(completeActionItem("action-1", { completionNote: "完成结果" })).rejects.toThrow("log write failed");
    expect(mocks.updateAction).toHaveBeenCalledTimes(1);
  });
});
