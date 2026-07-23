import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findProject: vi.fn(),
  findItem: vi.fn(),
  createItem: vi.fn(),
  createLog: vi.fn(),
  createAction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    project: { findUnique: mocks.findProject },
    workItem: { findUnique: mocks.findItem },
  },
}));

import {
  CompositeInputError,
  createWorkItemWithActions,
  createWorkLogWithContext,
} from "@/lib/recordingTransaction";

function useTransactionClient() {
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      workItem: { create: mocks.createItem },
      workLog: { create: mocks.createLog },
      actionItem: { create: mocks.createAction },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useTransactionClient();
});

describe("atomic recording transactions", () => {
  it("creates an item and every action item through one transaction", async () => {
    mocks.createItem.mockResolvedValue({ id: "item-1", projectId: "project-1" });
    mocks.createAction.mockResolvedValue({ id: "action-1" });
    mocks.findProject.mockResolvedValue({ id: "project-1", name: "项目 A" });

    const result = await createWorkItemWithActions({
      title: "发布跟进",
      projectId: "project-1",
      actionItems: [{ title: "确认版本" }, { title: "更新日报", status: "done", doneNote: "日报已同步" }],
    });

    expect(result.item.id).toBe("item-1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createItem).toHaveBeenCalledTimes(1);
    expect(mocks.createItem).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: "project-1", project: "项目 A" }),
    }));
    expect(mocks.createAction).toHaveBeenCalledTimes(2);
    expect(mocks.createAction).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: "item-1", projectId: "project-1", status: "done" }),
    }));
  });

  it("creates a context log and action items linked to its existing item and log", async () => {
    mocks.findItem.mockResolvedValue({
      id: "item-1",
      projectId: "project-1",
      project: "旧项目名",
      projectRef: { name: "项目 A" },
    });
    mocks.createLog.mockResolvedValue({ id: "log-1", itemId: "item-1", projectId: "project-1" });
    mocks.createAction.mockResolvedValue({ id: "action-1" });

    const result = await createWorkLogWithContext({
      title: "风险同步",
      content: "等待外部确认",
      itemId: "item-1",
      project: "项目 B",
      actionItems: [{ title: "明日跟进" }],
    }, { requireItemContext: true });

    expect(result.log.id).toBe("log-1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createLog).toHaveBeenCalledTimes(1);
    expect(mocks.createLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: "project-1", project: "项目 A" }),
    }));
    expect(mocks.createAction).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: "item-1", workLogId: "log-1", projectId: "project-1" }),
    }));
  });

  it("uses the requested project's canonical name when its id is provided", async () => {
    mocks.findProject.mockResolvedValue({ id: "project-1", name: "项目 A" });
    mocks.createLog.mockResolvedValue({ id: "log-1", itemId: null, projectId: "project-1" });

    const result = await createWorkLogWithContext({
      title: "项目事实",
      content: "请求项目关系优先",
      projectId: "project-1",
      project: "项目 B",
    });

    expect(result.log.projectId).toBe("project-1");
    expect(mocks.createLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: "project-1", project: "项目 A" }),
    }));
  });

  it("rejects a project conflict before starting the transaction", async () => {
    mocks.findItem.mockResolvedValue({
      id: "item-1",
      projectId: "project-1",
      project: "项目 A",
      projectRef: { name: "项目 A" },
    });
    mocks.findProject.mockResolvedValue({ id: "project-2", name: "项目 B" });

    await expect(createWorkLogWithContext({
      title: "冲突日志",
      content: "项目范围不一致",
      itemId: "item-1",
      projectId: "project-2",
    }, { requireItemContext: true })).rejects.toThrow("事项与日志项目不一致");

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("creates an unassociated log without an item context", async () => {
    mocks.createLog.mockResolvedValue({ id: "log-1", itemId: null, projectId: null });
    mocks.createAction.mockResolvedValue({ id: "action-1" });

    const result = await createWorkLogWithContext({
      title: "事实记录",
      content: "记录一个不需要事项跟踪的事实",
      actionItems: [{ title: "后续确认" }],
    });

    expect(result.log.itemId).toBeNull();
    expect(mocks.createItem).not.toHaveBeenCalled();
    expect(mocks.createAction).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: null, workLogId: "log-1", projectId: null }),
    }));
  });

  it("inherits the selected project for an unassociated log action item", async () => {
    mocks.findProject.mockResolvedValue({ id: "project-1", name: "项目 A" });
    mocks.createLog.mockResolvedValue({ id: "log-1", itemId: null, projectId: "project-1" });
    mocks.createAction.mockResolvedValue({ id: "action-1" });

    const result = await createWorkLogWithContext({
      title: "项目事实",
      content: "记录项目级事实",
      projectId: "project-1",
      actionItems: [{ title: "项目后续确认" }],
    });

    expect(result.log.itemId).toBeNull();
    expect(result.log.projectId).toBe("project-1");
    expect(mocks.createItem).not.toHaveBeenCalled();
    expect(mocks.createAction).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: null, workLogId: "log-1", projectId: "project-1" }),
    }));
  });

  it("keeps new item and log creation atomic with linked action items", async () => {
    mocks.createItem.mockResolvedValue({ id: "item-1", projectId: null });
    mocks.createLog.mockResolvedValue({ id: "log-1", itemId: "item-1", projectId: null });
    mocks.createAction.mockResolvedValue({ id: "action-1" });

    const result = await createWorkLogWithContext({
      title: "建立跟进事项",
      content: "记录事实并创建后续跟进对象",
      newItem: { title: "后续跟进", type: "action", status: "open" },
      actionItems: [{ title: "确认负责人" }],
    }, { requireItemContext: true });

    expect(result.item?.id).toBe("item-1");
    expect(result.log.itemId).toBe("item-1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createItem).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: null, project: null }),
    }));
    expect(mocks.createAction).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: "item-1", workLogId: "log-1" }),
    }));
  });

  it("rejects invalid action input before starting a transaction", async () => {
    await expect(createWorkItemWithActions({
      title: "发布跟进",
      actionItems: [{ title: "确认版本", dueDate: "2026-02-30" }],
    })).rejects.toBeInstanceOf(CompositeInputError);

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createItem).not.toHaveBeenCalled();
  });

  it("rejects an invalid project id before starting a transaction", async () => {
    mocks.findProject.mockResolvedValue(null);

    await expect(createWorkItemWithActions({
      title: "项目事项",
      projectId: "missing-project",
      project: "前端伪造名称",
    })).rejects.toThrow("项目不存在");

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createItem).not.toHaveBeenCalled();
  });

  it("propagates an action write failure so the transaction can roll back all writes", async () => {
    mocks.createItem.mockResolvedValue({ id: "item-1", projectId: null });
    mocks.createAction.mockRejectedValue(new Error("action write failed"));

    await expect(createWorkItemWithActions({
      title: "发布跟进",
      actionItems: [{ title: "确认版本" }],
    })).rejects.toThrow("action write failed");

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createItem).toHaveBeenCalledTimes(1);
  });
});
