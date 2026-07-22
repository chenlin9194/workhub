import { Prisma } from "@prisma/client";
import {
  WBS_GATE_KEYS,
  WBS_GATE_RULES,
  WBS_PROJECT_PROFILES,
} from "@/lib/wbs/constants";
import type { WbsProjectProfile, WbsGateKey } from "@/lib/wbs/constants";
import { filterWbsNodesForProfile } from "@/lib/wbs/import";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, isValidYmdDateString } from "@/lib/utils";
import {
  deriveMilestoneStatus,
  deriveStrReadiness,
} from "@/lib/wbs/readiness";
import { validateExecutionTransition } from "@/lib/wbs/validation";
import type {
  WbsExistingPlanSummary,
  WbsInitializationConflict,
  WbsInitializationGatePreview,
  WbsInitializationPreview,
  WbsInitializationResult,
  WbsRoleSummary,
  WbsTemplateNode,
} from "@/lib/wbs/types";

type TemplateNodeRecord = Prisma.WbsTemplateNodeGetPayload<{ include: { parent: true } }>;
type ProjectInitializationData = Prisma.ProjectGetPayload<{
  include: {
    milestones: true;
    wbsPlan: { include: { _count: { select: { nodes: true } } } };
  };
}>;

export class WbsProjectNotFoundError extends Error {
  readonly status = 404;

  constructor(projectId: string) {
    super(`项目不存在：${projectId}`);
    this.name = "WbsProjectNotFoundError";
  }
}

export class WbsTemplateNotFoundError extends Error {
  readonly status = 409;

  constructor(version: string) {
    super(`未找到可用的 WBS 模板：${version}`);
    this.name = "WbsTemplateNotFoundError";
  }
}

export class WbsInitializationConflictError extends Error {
  readonly status = 409;
  readonly preview: WbsInitializationPreview;

  constructor(preview: WbsInitializationPreview) {
    super("WBS 初始化存在未解决冲突");
    this.name = "WbsInitializationConflictError";
    this.preview = preview;
  }
}

export class WbsNodeNotFoundError extends Error {
  readonly status = 404;

  constructor(nodeId: string) {
    super(`WBS 节点不存在：${nodeId}`);
    this.name = "WbsNodeNotFoundError";
  }
}

export class WbsInvalidNodeInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "WbsInvalidNodeInputError";
  }
}

function assertProfile(profile: string): asserts profile is WbsProjectProfile {
  if (!WBS_PROJECT_PROFILES.includes(profile as WbsProjectProfile)) {
    throw new Error(`不支持的 WBS 项目类型：${profile}`);
  }
}

export function isWbsProjectProfile(value: unknown): value is WbsProjectProfile {
  return typeof value === "string" && WBS_PROJECT_PROFILES.includes(value as WbsProjectProfile);
}

function dateToYmd(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function normalizeTitle(value: string): string {
  return value.trim().toLocaleUpperCase();
}

function titleContainsGate(title: string, gateKey: WbsGateKey): boolean {
  const normalized = normalizeTitle(title);
  return new RegExp(`(^|[^A-Z0-9])${gateKey}([^A-Z0-9]|$)`).test(normalized);
}

function toTemplateNode(node: TemplateNodeRecord): WbsTemplateNode {
  return {
    sheetName: "database",
    rowNumber: node.sortOrder,
    stage: node.stage as WbsTemplateNode["stage"],
    gateKey: node.gateKey as WbsTemplateNode["gateKey"],
    kind: node.kind as WbsTemplateNode["kind"],
    code: node.code,
    parentCode: node.parent?.code ?? null,
    title: node.title,
    description: node.description ?? "",
    role: node.role ?? "",
    projectScope: node.projectScope as WbsTemplateNode["projectScope"],
    processSupport: node.processSupport ?? "",
    deliverableSpec: node.deliverableSpec ?? "",
    sortOrder: node.sortOrder,
  };
}

function existingPlanSummary(
  plan: ProjectInitializationData["wbsPlan"],
): WbsExistingPlanSummary | null {
  if (!plan) return null;
  return {
    id: plan.id,
    profile: plan.profile as WbsProjectProfile,
    status: plan.status,
    initializedAt: plan.initializedAt?.toISOString() ?? null,
    nodeCount: plan._count.nodes,
  };
}

function findMilestoneCandidates(
  milestones: ProjectInitializationData["milestones"],
  gateKey: WbsGateKey,
) {
  return milestones.filter(
    (milestone) => milestone.gateKey === gateKey || titleContainsGate(milestone.title, gateKey),
  );
}

function buildGatePreviews(
  project: ProjectInitializationData,
  nodes: readonly WbsTemplateNode[],
): { gates: WbsInitializationGatePreview[]; conflicts: WbsInitializationConflict[] } {
  const conflicts: WbsInitializationConflict[] = [];
  const gates: WbsInitializationGatePreview[] = [];
  const usedMilestoneIds = new Set<string>();

  for (const rule of WBS_GATE_RULES) {
    const candidates = findMilestoneCandidates(project.milestones, rule.gateKey);
    const exactCandidates = candidates.filter((milestone) => milestone.gateKey === rule.gateKey);
    const chosen = exactCandidates.length === 1 ? exactCandidates[0] : candidates.length === 1 ? candidates[0] : null;

    if (candidates.length === 0) {
      conflicts.push({
        code: "missing-gate-milestone",
        gateKey: rule.gateKey,
        message: `${rule.gateKey} 缺少可匹配的项目里程碑`,
      });
    } else if (candidates.length > 1) {
      conflicts.push({
        code: "duplicate-gate-milestones",
        gateKey: rule.gateKey,
        milestoneIds: candidates.map((milestone) => milestone.id),
        message: `${rule.gateKey} 匹配到多个项目里程碑，请保留一个`,
      });
    }

    if (chosen && usedMilestoneIds.has(chosen.id)) {
      conflicts.push({
        code: "milestone-reused",
        gateKey: rule.gateKey,
        milestoneIds: [chosen.id],
        message: `${rule.gateKey} 与其他 STR 复用了同一个项目里程碑`,
      });
    }
    if (chosen) usedMilestoneIds.add(chosen.id);

    gates.push({
      gateKey: rule.gateKey,
      stage: rule.stage,
      milestoneId: chosen?.id ?? null,
      milestoneTitle: chosen?.title ?? null,
      targetDate: dateToYmd(chosen?.targetDate ?? null),
      matchedBy: chosen ? (chosen.gateKey === rule.gateKey ? "gateKey" : "title") : null,
      applicableNodeCount: nodes.filter((node) => node.gateKey === rule.gateKey).length,
    });
  }

  return { gates, conflicts };
}

function roleSummary(nodes: readonly WbsTemplateNode[]): WbsRoleSummary {
  const roles = [...new Set(nodes.map((node) => node.role.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
  return {
    roleAssignmentCount: nodes.filter((node) => node.role.trim()).length,
    roleCount: roles.length,
    roles,
  };
}

function splitDeliverables(specification: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of specification.split(/[\r\n;；]+/)) {
    const title = part.replace(/^\s*(?:\d+[.)、]|[-*])\s*/, "").trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    result.push(title);
  }
  return result;
}

function orderedNodes(nodes: readonly WbsTemplateNode[]): WbsTemplateNode[] {
  return [...nodes].sort((left, right) => {
    if (left.kind === "task" && right.kind !== "task") return 1;
    if (left.kind !== "task" && right.kind === "task") return -1;
    return left.sortOrder - right.sortOrder;
  });
}

async function loadInitializationData(projectId: string, templateVersion: string) {
  const [project, template] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: [{ sortOrder: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }] },
        wbsPlan: { include: { _count: { select: { nodes: true } } } },
      },
    }),
    prisma.wbsTemplate.findFirst({
      where: { version: templateVersion, status: "active" },
      include: { nodes: { include: { parent: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    }),
  ]);

  if (!project) throw new WbsProjectNotFoundError(projectId);
  if (!template) throw new WbsTemplateNotFoundError(templateVersion);
  return { project, template };
}

function buildPreviewFromData(
  project: ProjectInitializationData,
  template: { id: string; version: string; sourceFileName: string; sourceHash: string; nodes: TemplateNodeRecord[] },
  profile: WbsProjectProfile,
): WbsInitializationPreview {
  const nodes = filterWbsNodesForProfile(template.nodes.map(toTemplateNode), profile);
  const gateResult = buildGatePreviews(project, nodes);
  const roleSummaryResult = roleSummary(nodes);
  const deliverables = nodes.reduce((count, node) => count + splitDeliverables(node.deliverableSpec).length, 0);
  const executionItems = gateResult.gates.filter((gate) => gate.milestoneId).length;

  return {
    project: { id: project.id, name: project.name, type: project.type },
    template: {
      id: template.id,
      version: template.version,
      sourceFileName: template.sourceFileName,
      sourceHash: template.sourceHash,
      nodeCount: template.nodes.length,
    },
    profile,
    gates: gateResult.gates,
    counts: {
      nodes: nodes.length,
      packages: nodes.filter((node) => node.kind === "package").length,
      tasks: nodes.filter((node) => node.kind === "task").length,
      reviews: nodes.filter((node) => node.kind === "gate").length,
      deliverables,
      executionItems,
    },
    roleSummary: roleSummaryResult,
    existingPlan: existingPlanSummary(project.wbsPlan),
    conflicts: gateResult.conflicts,
    ready: gateResult.conflicts.length === 0,
  };
}

export async function buildWbsInitializationPreview(
  projectId: string,
  profile: WbsProjectProfile,
  templateVersion = "V2.0",
): Promise<WbsInitializationPreview> {
  assertProfile(profile);
  const { project, template } = await loadInitializationData(projectId, templateVersion);
  return buildPreviewFromData(project, template, profile);
}

function gateMapFromPreview(preview: WbsInitializationPreview): Map<WbsGateKey, WbsInitializationGatePreview> {
  return new Map(preview.gates.map((gate) => [gate.gateKey, gate]));
}

function generatedExecutionItemData(args: {
  project: { id: string; name: string };
  milestoneId: string;
  gateKey: WbsGateKey;
  dueDate: string | null;
  originWbsNodeId: string;
  status: string;
  closedAt: Date | null;
}) {
  return {
    title: `[${args.gateKey}] 节点准备与评审`,
    description: `由 WBS ${args.gateKey} 里程碑初始化生成`,
    project: args.project.name,
    projectId: args.project.id,
    type: "milestone",
    priority: "P2",
    status: args.status,
    owner: null,
    dueDate: args.dueDate,
    nextAction: `${args.gateKey} 评审准备与问题闭环`,
    trackingReason: "WBS 模板节点执行",
    sourceSystem: "wbs",
    sourceId: `wbs-v2.0-${args.gateKey}`,
    sourceUrl: null,
    health: "unknown",
    currentSummary: null,
    nextCheckpoint: null,
    reportLevel: "project",
    tags: "WBS",
    executionMilestoneId: args.milestoneId,
    originWbsNodeId: args.originWbsNodeId,
    managedBy: "wbs",
    closedAt: args.closedAt,
  };
}

export async function initializeProjectWbs(
  projectId: string,
  profile: WbsProjectProfile,
  templateVersion = "V2.0",
): Promise<WbsInitializationResult> {
  assertProfile(profile);
  const preview = await buildWbsInitializationPreview(projectId, profile, templateVersion);
  if (!preview.ready) throw new WbsInitializationConflictError(preview);

  const gateMap = gateMapFromPreview(preview);
  const { template } = await loadInitializationData(projectId, templateVersion);
  const templateNodes = filterWbsNodesForProfile(template.nodes.map(toTemplateNode), profile);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
      },
    });
    if (!project) throw new WbsProjectNotFoundError(projectId);

    const milestones = await tx.projectMilestone.findMany({
      where: { projectId },
      select: { id: true, title: true, targetDate: true, gateKey: true },
    });
    const milestoneByGate = new Map<WbsGateKey, (typeof milestones)[number]>();
    for (const gate of WBS_GATE_KEYS) {
      const expected = gateMap.get(gate);
      const milestone = milestones.find((candidate) => candidate.id === expected?.milestoneId);
      if (!expected?.milestoneId || !milestone || (milestone.gateKey !== null && milestone.gateKey !== gate)) {
        throw new Error(`${gate} 里程碑在初始化事务中发生变化，请重新预览`);
      }
      milestoneByGate.set(gate, milestone);
    }

    const existingPlan = await tx.projectWbsPlan.findUnique({ where: { projectId } });
    const plan = existingPlan
      ? await tx.projectWbsPlan.update({
          where: { id: existingPlan.id },
          data: {
            templateId: template.id,
            profile,
            status: "active",
            initializedAt: existingPlan.initializedAt ?? now,
          },
        })
      : await tx.projectWbsPlan.create({
          data: {
            projectId,
            templateId: template.id,
            profile,
            status: "active",
            initializedAt: now,
          },
        });

    const nodeIdByKey = new Map<string, string>();
    let packageCount = 0;
    let taskCount = 0;
    let reviewCount = 0;
    let deliverableCreatedCount = 0;
    const persistedGateNodes = new Map<WbsGateKey, { id: string; milestoneId: string }>();

    for (const node of orderedNodes(templateNodes)) {
      const milestone = milestoneByGate.get(node.gateKey);
      if (!milestone) throw new Error(`${node.gateKey} 缺少目标里程碑`);
      const parentId = node.parentCode
        ? nodeIdByKey.get(`${node.stage}|${node.gateKey}|${node.parentCode}`) ?? null
        : null;
      if (node.kind === "task" && !parentId) {
        throw new Error(`任务 ${node.code} 找不到同 STR 工作包父节点`);
      }

      const nodeData = {
        planId: plan.id,
        projectId,
        milestoneId: milestone.id,
        templateNodeId: template.nodes.find(
          (candidate) => candidate.stage === node.stage && candidate.gateKey === node.gateKey && candidate.code === node.code,
        )?.id ?? null,
        parentId,
        kind: node.kind,
        gateKey: node.gateKey,
        code: node.code,
        title: node.title,
        description: node.description || null,
        role: node.role || null,
        ownerMemberId: null,
        ownerName: null,
        sortOrder: node.sortOrder,
      };
      const persisted = await tx.projectWbsNode.upsert({
        where: { planId_gateKey_code: { planId: plan.id, gateKey: node.gateKey, code: node.code } },
        create: { ...nodeData, status: node.kind === "package" ? null : "not_started" },
        update: nodeData,
      });
      nodeIdByKey.set(`${node.stage}|${node.gateKey}|${node.code}`, persisted.id);
      if (node.kind === "package") packageCount += 1;
      else if (node.kind === "task") taskCount += 1;
      else {
        reviewCount += 1;
        persistedGateNodes.set(node.gateKey, { id: persisted.id, milestoneId: milestone.id });
      }

      const existingDeliverables = await tx.projectWbsDeliverable.findMany({
        where: { nodeId: persisted.id },
        select: { title: true },
      });
      const existingTitles = new Set(existingDeliverables.map((deliverable) => deliverable.title));
      for (const [sortOrder, title] of splitDeliverables(node.deliverableSpec).entries()) {
        if (existingTitles.has(title)) continue;
        await tx.projectWbsDeliverable.create({
          data: { nodeId: persisted.id, title, required: true, status: "pending", sortOrder },
        });
        deliverableCreatedCount += 1;
      }
    }

    let executionItemCreatedCount = 0;
    let executionItemUpdatedCount = 0;
    for (const gate of WBS_GATE_RULES) {
      const milestone = milestoneByGate.get(gate.gateKey);
      const reviewNode = persistedGateNodes.get(gate.gateKey);
      if (!milestone || !reviewNode) throw new Error(`${gate.gateKey} 缺少评审节点或项目里程碑`);

      if (milestone.gateKey === null) {
        await tx.projectMilestone.update({ where: { id: milestone.id }, data: { gateKey: gate.gateKey } });
      }

      const existingItem = await tx.workItem.findUnique({ where: { executionMilestoneId: milestone.id } });
      const itemData = generatedExecutionItemData({
        project,
        milestoneId: milestone.id,
        gateKey: gate.gateKey,
        dueDate: dateToYmd(milestone.targetDate),
        originWbsNodeId: reviewNode.id,
        status: existingItem?.status ?? "open",
        closedAt: existingItem?.closedAt ?? null,
      });
      if (existingItem) {
        await tx.workItem.update({ where: { id: existingItem.id }, data: itemData });
        executionItemUpdatedCount += 1;
      } else {
        await tx.workItem.create({ data: itemData });
        executionItemCreatedCount += 1;
      }
    }

    return {
      planId: plan.id,
      templateId: template.id,
      profile,
      nodeCount: templateNodes.length,
      packageCount,
      taskCount,
      reviewCount,
      deliverableCreatedCount,
      executionItemCreatedCount,
      executionItemUpdatedCount,
      linkedGateCount: WBS_GATE_RULES.filter((gate) => milestoneByGate.get(gate.gateKey)?.gateKey === null).length,
      initializedAt: plan.initializedAt?.toISOString() ?? now.toISOString(),
    };
  });
}

export async function getProjectWbsSummary(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      type: true,
      pm: true,
      wbsPlan: {
        include: {
          template: { select: { id: true, version: true, sourceFileName: true, sourceHash: true } },
          nodes: {
            include: {
              deliverables: true,
              milestone: { include: { executionWorkItem: { select: { id: true, title: true, status: true, health: true } } } },
              ownerMember: true,
              originWorkItems: { select: { id: true, title: true, status: true } },
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!project) throw new WbsProjectNotFoundError(projectId);

  if (!project.wbsPlan) return { project, plan: null };
  return {
    project,
    plan: {
      ...project.wbsPlan,
      initializedAt: project.wbsPlan.initializedAt?.toISOString() ?? null,
      createdAt: project.wbsPlan.createdAt.toISOString(),
      updatedAt: project.wbsPlan.updatedAt.toISOString(),
      nodes: project.wbsPlan.nodes.map((node) => ({
        ...node,
        internalCheckDate: node.internalCheckDate,
        completedAt: node.completedAt?.toISOString() ?? null,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
        milestone: {
          ...node.milestone,
          targetDate: node.milestone.targetDate?.toISOString() ?? null,
          actualDate: node.milestone.actualDate?.toISOString() ?? null,
          createdAt: node.milestone.createdAt.toISOString(),
          updatedAt: node.milestone.updatedAt.toISOString(),
        },
        deliverables: node.deliverables.map((deliverable) => ({
          ...deliverable,
          createdAt: deliverable.createdAt.toISOString(),
          updatedAt: deliverable.updatedAt.toISOString(),
        })),
      })),
    },
  };
}

function textInput(value: unknown, fallback: string | null): string | null {
  if (typeof value !== "string") return fallback;
  return value.trim() || null;
}

function patchTextInput(input: Record<string, unknown>, field: string, fallback: string | null): string | null {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return fallback;
  const value = input[field];
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new WbsInvalidNodeInputError(`${field} 必须是文本`);
  return value.trim() || null;
}

function executionItemStatus(readiness: ReturnType<typeof deriveStrReadiness>): "open" | "following" | "blocked" | "closed" {
  if (readiness.status === "blocked") return "blocked";
  if (readiness.status === "closed") return "closed";
  if (readiness.status === "in_progress") return "following";
  return "open";
}

export async function updateWbsNode(
  projectId: string,
  nodeId: string,
  input: Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    const node = await tx.projectWbsNode.findFirst({
      where: { id: nodeId, projectId },
      include: {
        deliverables: { orderBy: { sortOrder: "asc" } },
        milestone: true,
        originWorkItems: { select: { id: true, title: true, status: true } },
      },
    });
    if (!node) throw new WbsNodeNotFoundError(nodeId);
    if (node.kind === "package" || !node.status) {
      throw new WbsInvalidNodeInputError("工作包状态由子任务自动计算，不能直接编辑");
    }

    const nextStatus = input.status === undefined ? node.status : input.status;
    if (typeof nextStatus !== "string" || !["not_started", "in_progress", "blocked", "done", "waived"].includes(nextStatus)) {
      throw new WbsInvalidNodeInputError("无效的 WBS 执行状态");
    }

    const completionNote = patchTextInput(input, "completionNote", node.completionNote);
    const blockedReason = patchTextInput(input, "blockedReason", node.blockedReason);
    const waiverReason = patchTextInput(input, "waiverReason", node.waiverReason);
    let internalCheckDate = node.internalCheckDate;
    if (Object.prototype.hasOwnProperty.call(input, "internalCheckDate")) {
      if (input.internalCheckDate === null || input.internalCheckDate === "") {
        internalCheckDate = null;
      } else if (typeof input.internalCheckDate !== "string" || !isValidYmdDateString(input.internalCheckDate.trim())) {
        throw new WbsInvalidNodeInputError("内部检查日期格式必须是 YYYY-MM-DD");
      } else {
        internalCheckDate = input.internalCheckDate.trim();
      }
    }
    const proposedDeliverables = new Map(
      node.deliverables.map((deliverable) => [deliverable.id, {
        status: deliverable.status,
        evidenceUrl: deliverable.evidenceUrl,
      }]),
    );

    if (input.deliverables !== undefined) {
      if (!Array.isArray(input.deliverables)) {
        throw new WbsInvalidNodeInputError("deliverables 必须是数组");
      }
      for (const entry of input.deliverables) {
        if (typeof entry !== "object" || entry === null) {
          throw new WbsInvalidNodeInputError("交付物更新格式无效");
        }
        const record = entry as Record<string, unknown>;
        const deliverableId = typeof record.id === "string" ? record.id : "";
        const current = proposedDeliverables.get(deliverableId);
        if (!current) throw new WbsInvalidNodeInputError("交付物不属于当前 WBS 节点");
        if (record.status !== undefined && (record.status !== "pending" && record.status !== "delivered")) {
          throw new WbsInvalidNodeInputError("无效的交付物状态");
        }
        proposedDeliverables.set(deliverableId, {
          status: record.status === undefined ? current.status : record.status,
          evidenceUrl: record.evidenceUrl === undefined ? current.evidenceUrl : textInput(record.evidenceUrl, null),
        });
      }
    }

    const transition = validateExecutionTransition({
      currentStatus: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived",
      nextStatus: nextStatus as "not_started" | "in_progress" | "blocked" | "done" | "waived",
      completionNote,
      blockedReason,
      waiverReason,
      requiredDeliverables: node.deliverables.map((deliverable) => ({
        required: deliverable.required,
        status: proposedDeliverables.get(deliverable.id)?.status as "pending" | "delivered",
      })),
    });
    if (!transition.ok) throw new WbsInvalidNodeInputError(transition.errors.join("；"));

    const completedAt = transition.shouldSetCompletedAt
      ? node.completedAt ?? new Date()
      : transition.shouldClearCompletedAt
        ? null
        : node.completedAt;
    const updatedNode = await tx.projectWbsNode.update({
      where: { id: node.id },
      data: {
        status: nextStatus,
        completionNote,
        blockedReason,
        waiverReason,
        completedAt,
        internalCheckDate,
      },
    });

    if (input.deliverables !== undefined) {
      for (const deliverable of node.deliverables) {
        const next = proposedDeliverables.get(deliverable.id);
        if (!next) continue;
        await tx.projectWbsDeliverable.update({
          where: { id: deliverable.id },
          data: { status: next.status, evidenceUrl: next.evidenceUrl },
        });
      }
    }

    const gateNodes = await tx.projectWbsNode.findMany({
      where: { planId: node.planId, gateKey: node.gateKey },
      include: { deliverables: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const readiness = deriveStrReadiness(node.gateKey as WbsGateKey, gateNodes.map((candidate) => ({
      kind: candidate.kind as "package" | "task" | "gate",
      status: candidate.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
      requiredDeliverables: candidate.deliverables.map((deliverable) => ({
        required: deliverable.required,
        status: deliverable.status as "pending" | "delivered",
      })),
    })));
    const milestone = await tx.projectMilestone.findUnique({ where: { id: node.milestoneId } });
    if (!milestone) throw new WbsInvalidNodeInputError("WBS 关联里程碑不存在");
    const milestoneStatus = deriveMilestoneStatus(
      gateNodes.map((candidate) => ({
        kind: candidate.kind as "package" | "task" | "gate",
        status: candidate.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
      })),
      dateToYmd(milestone.targetDate),
      getLocalDateString(),
    );
    const mappedMilestoneStatus = milestoneStatus === "not_started" ? "planned" : milestoneStatus;
    const nextActualDate = milestoneStatus === "done"
      ? milestone.actualDate ?? new Date()
      : milestone.status === "done"
        ? null
        : milestone.actualDate;
    const updatedMilestone = await tx.projectMilestone.update({
      where: { id: milestone.id },
      data: { status: mappedMilestoneStatus, actualDate: nextActualDate },
    });

    const executionItem = await tx.workItem.findUnique({ where: { executionMilestoneId: milestone.id } });
    let updatedExecutionItem = executionItem;
    if (executionItem) {
      const nextItemStatus = executionItemStatus(readiness);
      updatedExecutionItem = await tx.workItem.update({
        where: { id: executionItem.id },
        data: {
          status: nextItemStatus,
          health: readiness.status === "blocked" ? "red" : milestoneStatus === "delayed" ? "yellow" : "unknown",
          nextAction: readiness.nextAction ?? `${node.gateKey} 执行跟进`,
          closedAt: nextItemStatus === "closed" ? executionItem.closedAt ?? new Date() : null,
        },
      });
    }

    const linkedOpenItemCount = node.originWorkItems.filter((item) => item.status !== "closed").length;
    return {
      node: updatedNode,
      readiness,
      milestone: updatedMilestone,
      executionItem: updatedExecutionItem,
      warnings: nextStatus === "done" && linkedOpenItemCount > 0
        ? [`当前仍有 ${linkedOpenItemCount} 个关联普通事项未关闭；WBS 任务已完成，但请继续跟进关联事项`]
        : [],
    };
  });
}

export async function splitWbsNodeIntoWorkItem(
  projectId: string,
  nodeId: string,
  input: Record<string, unknown>,
) {
  const node = await prisma.projectWbsNode.findFirst({
    where: { id: nodeId, projectId },
    include: { project: true, milestone: true },
  });
  if (!node) throw new WbsNodeNotFoundError(nodeId);
  if (node.kind !== "task") throw new WbsInvalidNodeInputError("只有 WBS 执行任务可以拆分为普通事项");

  const splitText = (field: string, fallback: string | null, required = false) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return fallback;
    const value = input[field];
    if (value === null || value === "") {
      if (required) throw new WbsInvalidNodeInputError(`${field} 不能为空`);
      return null;
    }
    if (typeof value !== "string") throw new WbsInvalidNodeInputError(`${field} 必须是文本`);
    const normalized = value.trim();
    if (required && !normalized) throw new WbsInvalidNodeInputError(`${field} 不能为空`);
    return normalized || null;
  };

  const title = splitText("title", node.title, true);
  if (!title) throw new WbsInvalidNodeInputError("title 不能为空");
  const dueDate = splitText("dueDate", dateToYmd(node.milestone.targetDate));
  if (dueDate && !isValidYmdDateString(dueDate)) {
    throw new WbsInvalidNodeInputError("截止日期格式必须是 YYYY-MM-DD");
  }

  return prisma.workItem.create({
    data: {
      title,
      description: splitText("description", node.description),
      project: node.project.name,
      projectId,
      module: node.gateKey,
      type: "action",
      priority: "P2",
      status: "open",
      owner: null,
      dueDate,
      nextAction: splitText("nextAction", `跟进 WBS 任务 ${node.code}`),
      trackingReason: `拆分自 WBS 任务 ${node.code}`,
      sourceSystem: "wbs",
      sourceId: node.code,
      health: "unknown",
      reportLevel: "project",
      originWbsNodeId: node.id,
    },
  });
}

export async function getWbsGateReadiness(projectId: string, gateKey: WbsGateKey) {
  const summary = await getProjectWbsSummary(projectId);
  if (!summary.plan) return { project: summary.project, plan: null, gateKey, readiness: null, nodes: [] };
  const nodes = summary.plan.nodes.filter((node) => node.gateKey === gateKey);
  const readiness = deriveStrReadiness(gateKey, nodes.map((node) => ({
    kind: node.kind as "package" | "task" | "gate",
    status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
    requiredDeliverables: node.deliverables.map((deliverable) => ({
      required: deliverable.required,
      status: deliverable.status as "pending" | "delivered",
    })),
  })));
  return { project: summary.project, plan: summary.plan, gateKey, readiness, nodes };
}

const STAGE_GATE_KEYS: Record<string, WbsGateKey[]> = {
  concept: ["STR1"],
  requirement: ["STR1"],
  planning: ["STR2", "STR3"],
  plan: ["STR2", "STR3"],
  development: ["STR4", "STR4A", "STR5"],
  testing: ["STR4", "STR4A", "STR5"],
  verification: ["STR4", "STR4A", "STR5"],
  development_validation: ["STR4", "STR4A", "STR5"],
  release: ["STR5"],
};

export async function getWbsStageReadiness(projectId: string, nextStage: string) {
  const summary = await getProjectWbsSummary(projectId);
  const gateKeys = STAGE_GATE_KEYS[nextStage] ?? WBS_GATE_KEYS;
  if (!summary.plan) {
    return { project: summary.project, hasPlan: false, nextStage, gateKeys, ready: true, gates: [] };
  }
  const gates = gateKeys.map((gateKey) => {
    const nodes = summary.plan?.nodes.filter((node) => node.gateKey === gateKey) ?? [];
    const readiness = deriveStrReadiness(gateKey, nodes.map((node) => ({
      kind: node.kind as "package" | "task" | "gate",
      status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
      requiredDeliverables: node.deliverables.map((deliverable) => ({
        required: deliverable.required,
        status: deliverable.status as "pending" | "delivered",
      })),
    })));
    return { gateKey, readiness };
  });
  return {
    project: summary.project,
    hasPlan: true,
    nextStage,
    gateKeys,
    ready: gates.every((gate) => gate.readiness.status === "closed"),
    gates,
  };
}
