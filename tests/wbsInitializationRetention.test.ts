import { beforeEach, describe, expect, it, vi } from "vitest";
import { WBS_GATE_RULES, WBS_GLOBAL_PROFILE } from "@/lib/wbs/constants";

const mocks = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  templateFindFirst: vi.fn(),
  transaction: vi.fn(),
  txProjectFindUnique: vi.fn(),
  txMilestoneFindMany: vi.fn(),
  txPlanFindUnique: vi.fn(),
  txPlanUpdate: vi.fn(),
  txNodeUpsert: vi.fn(),
  persistedNodes: new Map<string, Record<string, unknown>>(),
  txDeliverableFindMany: vi.fn(),
  txMilestoneUpdate: vi.fn(),
  txWorkItemFindUnique: vi.fn(),
  txWorkItemCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    wbsTemplate: { findFirst: mocks.templateFindFirst },
    $transaction: mocks.transaction,
  },
}));

import { initializeProjectWbs } from "@/lib/wbs/service";

function fixtures() {
  const milestones = WBS_GATE_RULES.map((rule, index) => ({
    id: `milestone-${index}`,
    title: rule.reviewTitle,
    targetDate: null,
    gateKey: rule.gateKey,
  }));
  const templateNodes = WBS_GATE_RULES.map((rule, index) => ({
    id: `template-node-${index}`,
    stage: rule.stage,
    gateKey: rule.gateKey,
    kind: "gate",
    code: rule.reviewCode,
    parent: null,
    title: rule.reviewTitle,
    description: null,
    role: null,
    processSupport: null,
    deliverableSpec: null,
    sortOrder: index,
  }));
  return {
    milestones,
    template: {
      id: "template-1",
      version: "v2",
      sourceFileName: "wbs.xlsx",
      sourceHash: "hash",
      nodes: templateNodes,
    },
    project: {
      id: "project-1",
      name: "测试项目",
      type: "software",
      milestones,
      wbsPlan: {
        id: "plan-1",
        profile: WBS_GLOBAL_PROFILE,
        status: "active",
        initializedAt: new Date("2026-08-01T00:00:00.000Z"),
        nodes: [{ id: "removed-node" }],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.persistedNodes.clear();
  const data = fixtures();
  mocks.projectFindUnique.mockResolvedValue(data.project);
  mocks.templateFindFirst.mockResolvedValue(data.template);
  mocks.txProjectFindUnique.mockResolvedValue({ id: data.project.id, name: data.project.name });
  mocks.txMilestoneFindMany.mockResolvedValue(data.milestones);
  mocks.txPlanFindUnique.mockResolvedValue({ id: "plan-1" });
  mocks.txPlanUpdate.mockResolvedValue({ id: "plan-1", initializedAt: data.project.wbsPlan.initializedAt });
  mocks.txNodeUpsert.mockImplementation(async ({ where, create, update }: {
    where: { planId_gateKey_code: { gateKey: string; code: string } };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => {
    const key = `${where.planId_gateKey_code.gateKey}:${where.planId_gateKey_code.code}`;
    const existing = mocks.persistedNodes.get(key);
    const persisted = existing ? { ...existing, ...update } : { ...create, id: `project-node-${key}` };
    mocks.persistedNodes.set(key, persisted);
    return persisted;
  });
  mocks.txDeliverableFindMany.mockResolvedValue([]);
  mocks.txMilestoneUpdate.mockResolvedValue({});
  mocks.txWorkItemFindUnique.mockResolvedValue(null);
  mocks.txWorkItemCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (callback) => callback({
    project: { findUnique: mocks.txProjectFindUnique },
    projectMilestone: { findMany: mocks.txMilestoneFindMany, update: mocks.txMilestoneUpdate },
    projectWbsPlan: { findUnique: mocks.txPlanFindUnique, update: mocks.txPlanUpdate },
    projectWbsNode: { upsert: mocks.txNodeUpsert },
    projectWbsDeliverable: { findMany: mocks.txDeliverableFindMany },
    workItem: { findUnique: mocks.txWorkItemFindUnique, create: mocks.txWorkItemCreate },
  }));
});

describe("WBS initialization soft-removal retention", () => {
  it("does not create or restore gate execution WorkItems during initialization", async () => {
    const first = await initializeProjectWbs("project-1", "v2");
    const second = await initializeProjectWbs("project-1", "v2");

    expect(mocks.txWorkItemFindUnique).not.toHaveBeenCalled();
    expect(mocks.txWorkItemCreate).not.toHaveBeenCalled();
    expect(first.executionItemCreatedCount).toBe(0);
    expect(first.executionItemUpdatedCount).toBe(0);
    expect(second.executionItemCreatedCount).toBe(0);
    expect(second.executionItemUpdatedCount).toBe(0);
  });

  it("retains removal metadata and owner assignment on same-key reinitialize", async () => {
    const removedAt = new Date("2026-08-20T00:00:00.000Z");
    for (const rule of WBS_GATE_RULES) {
      mocks.persistedNodes.set(`${rule.gateKey}:${rule.reviewCode}`, {
        id: `existing-${rule.gateKey}`,
        removedAt,
        removalReason: "原始移除原因",
        ownerMemberId: "member-1",
        ownerName: "原负责人",
      });
    }

    await initializeProjectWbs("project-1", "v2");

    expect(mocks.txNodeUpsert).toHaveBeenCalledTimes(WBS_GATE_RULES.length);
    for (const rule of WBS_GATE_RULES) {
      const call = mocks.txNodeUpsert.mock.calls.find(
        ([args]) => args.where.planId_gateKey_code.gateKey === rule.gateKey
          && args.where.planId_gateKey_code.code === rule.reviewCode,
      );
      expect(call).toBeDefined();
      const args = call![0];
      const persisted = mocks.persistedNodes.get(`${rule.gateKey}:${rule.reviewCode}`);

      expect(args.update).not.toHaveProperty("removedAt");
      expect(args.update).not.toHaveProperty("removalReason");
      expect(args.update).not.toHaveProperty("ownerMemberId");
      expect(args.update).not.toHaveProperty("ownerName");
      expect(args.create).toMatchObject({ ownerMemberId: null, ownerName: null });
      expect(persisted).toMatchObject({
        removedAt,
        removalReason: "原始移除原因",
        ownerMemberId: "member-1",
        ownerName: "原负责人",
      });
    }
  });
});
