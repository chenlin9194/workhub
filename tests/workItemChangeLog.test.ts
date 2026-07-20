import { describe, expect, it, vi } from "vitest";
import type { WorkItem } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  update: vi.fn(),
  createLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { updateWorkItemWithChangeLog } from "@/lib/workItemChangeLog";

function currentItem(): WorkItem {
  return {
    id: "item-1",
    title: "关键事项",
    description: null,
    project: "项目 A",
    projectId: "project-1",
    module: null,
    type: "action",
    priority: "P1",
    status: "open",
    owner: null,
    dueDate: null,
    nextAction: null,
    trackingReason: null,
    sourceSystem: null,
    sourceId: null,
    sourceUrl: null,
    health: "green",
    currentSummary: null,
    nextCheckpoint: null,
    reportLevel: "none",
    tags: null,
    createdAt: new Date("2026-07-20"),
    updatedAt: new Date("2026-07-20"),
    closedAt: null,
  };
}

describe("work item update change log transaction", () => {
  it("updates the item and creates its system log through one transaction client", async () => {
    const item = { ...currentItem(), status: "blocked" };
    mocks.update.mockResolvedValue(item);
    mocks.createLog.mockResolvedValue({ id: "log-1" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ workItem: { update: mocks.update }, workLog: { create: mocks.createLog } })
    );

    await expect(updateWorkItemWithChangeLog(currentItem(), { status: "blocked" }, { status: "blocked" }))
      .resolves.toEqual(item);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.createLog).toHaveBeenCalledTimes(1);
  });

  it("propagates a change-log failure so Prisma can roll back the item update", async () => {
    mocks.update.mockResolvedValue({ ...currentItem(), status: "blocked" });
    mocks.createLog.mockRejectedValue(new Error("log write failed"));
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ workItem: { update: mocks.update }, workLog: { create: mocks.createLog } })
    );

    await expect(updateWorkItemWithChangeLog(currentItem(), { status: "blocked" }, { status: "blocked" }))
      .rejects.toThrow("log write failed");
  });
});
