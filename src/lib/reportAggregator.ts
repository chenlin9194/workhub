import { prisma } from "@/lib/prisma";
import { getLocalDateString, isValidYmdDateString } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export type ReportLogSource = "item" | "actionItem" | "project";

export interface ReportLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  note: string | null;
  type: string;
  source: string;
  projectId: string | null;
  itemId: string | null;
  actionItemId: string | null;
  createdAt: string;
  isSystemLog: boolean;
  sourceKind: ReportLogSource;
}

export interface ReportActionItem {
  id: string;
  title: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  doneAt: string | null;
  completedInRange: boolean;
  logs: ReportLog[];
  latestLog: ReportLog | null;
}

export interface ReportWorkItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  health: string;
  currentSummary: string | null;
  nextAction: string | null;
  milestoneId: string | null;
  itemLogs: ReportLog[];
  actionItems: ReportActionItem[];
}

export interface ReportMilestone {
  id: string;
  title: string;
  gateKey: string | null;
  status: string;
  targetDate: string | null;
  actualDate: string | null;
  actualEndDate: string | null;
  workItems: ReportWorkItem[];
}

export interface ReportProject {
  id: string;
  name: string;
  code: string | null;
  status: string;
  health: string;
  owner: string | null;
  pm: string | null;
  description: string | null;
  projectLogs: ReportLog[];
  milestones: ReportMilestone[];
  projectItems: ReportWorkItem[];
}

export interface ReportAggregate {
  startDate: string;
  endDate: string;
  projectId: string | null;
  projects: ReportProject[];
  summary: {
    projects: number;
    milestones: number;
    workItems: number;
    actionItems: number;
    logs: number;
    systemLogs: number;
  };
}

export interface ReportAggregatorInput {
  startDate: string;
  endDate: string;
  projectId?: string | null;
}

export interface ReportSourceLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  note?: string | null;
  type: string;
  source: string;
  projectId?: string | null;
  itemId?: string | null;
  actionItemId?: string | null;
  reportable?: boolean;
  createdAt: Date | string;
}

export interface ReportSourceActionItem {
  id: string;
  title: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  doneAt?: Date | string | null;
  progressLogs: ReportSourceLog[];
}

export interface ReportSourceWorkItem {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  health: string;
  currentSummary?: string | null;
  nextAction?: string | null;
  milestoneId?: string | null;
  managedBy?: string | null;
  executionMilestoneId?: string | null;
  originWbsNode?: { kind: string } | null;
  logs: ReportSourceLog[];
  actionItems: ReportSourceActionItem[];
}

export interface ReportSourceMilestone {
  id: string;
  title: string;
  gateKey?: string | null;
  status: string;
  targetDate?: Date | string | null;
  actualDate?: Date | string | null;
  actualEndDate?: Date | string | null;
}

export interface ReportSourceProject {
  id: string;
  name: string;
  code?: string | null;
  status: string;
  health: string;
  owner?: string | null;
  pm?: string | null;
  description?: string | null;
  logs: ReportSourceLog[];
  milestones: ReportSourceMilestone[];
  items: ReportSourceWorkItem[];
}

function assertDateRange(input: ReportAggregatorInput) {
  if (!isValidYmdDateString(input.startDate) || !isValidYmdDateString(input.endDate)) {
    throw new Error("报告日期必须是有效的 YYYY-MM-DD");
  }
  if (input.startDate > input.endDate) {
    throw new Error("报告开始日期不能晚于结束日期");
  }
}

function asIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function asDateString(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string" && isValidYmdDateString(value)) return value;
  return getLocalDateString(value instanceof Date ? value : new Date(value));
}

function inRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

export function isLegacySystemLog(log: Pick<ReportSourceLog, "title"> & Partial<Pick<ReportSourceLog, "actionItemId">>) {
  if (log.actionItemId) return false;
  return log.title.startsWith("事项变化：") || log.title.startsWith("浜嬮」鍙樺寲");
}

export function isWbsGateExecutionItem(item: Pick<ReportSourceWorkItem, "managedBy" | "executionMilestoneId" | "originWbsNode">) {
  return item.managedBy === "wbs" && Boolean(item.executionMilestoneId) && item.originWbsNode?.kind === "gate";
}

function toReportLog(log: ReportSourceLog, sourceKind: ReportLogSource): ReportLog {
  return {
    id: log.id,
    workDate: log.workDate,
    title: log.title,
    content: log.content,
    note: log.note ?? null,
    type: log.type,
    source: log.source,
    projectId: log.projectId ?? null,
    itemId: log.itemId ?? null,
    actionItemId: log.actionItemId ?? null,
    createdAt: asIso(log.createdAt) ?? "",
    isSystemLog: isLegacySystemLog(log),
    sourceKind,
  };
}

function uniqueLogs(logs: ReportLog[]) {
  const seen = new Set<string>();
  return logs.filter((log) => {
    if (seen.has(log.id)) return false;
    seen.add(log.id);
    return true;
  });
}

function byNewest(a: ReportLog, b: ReportLog) {
  return b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

function toReportWorkItem(
  item: ReportSourceWorkItem,
  input: ReportAggregatorInput,
): ReportWorkItem | null {
  if (isWbsGateExecutionItem(item)) return null;

  const itemLogs = uniqueLogs(
    item.logs
      .filter((log) => inRange(log.workDate, input.startDate, input.endDate) && !log.actionItemId)
      .map((log) => toReportLog(log, "item")),
  ).sort(byNewest);

  const actions = item.actionItems
    .map((action) => {
      const allLogs = uniqueLogs(action.progressLogs.map((log) => toReportLog(log, "actionItem"))).sort(byNewest);
      const logs = allLogs.filter((log) => inRange(log.workDate, input.startDate, input.endDate));
      const doneAt = asDateString(action.doneAt);
      const completedInRange = Boolean(doneAt && inRange(doneAt, input.startDate, input.endDate));
      return {
        id: action.id,
        title: action.title,
        status: action.status,
        owner: action.owner ?? null,
        dueDate: action.dueDate ?? null,
        doneAt,
        completedInRange,
        logs,
        latestLog: allLogs[0] ?? null,
        relevant: logs.length > 0 || completedInRange || (action.status !== "done" && action.status !== "closed"),
      };
    })
    .filter((action) => action.relevant || (itemLogs.length > 0 && action.status !== "done" && action.status !== "closed"));

  const reportActions = actions.map((action) => ({
    id: action.id,
    title: action.title,
    status: action.status,
    owner: action.owner,
    dueDate: action.dueDate,
    doneAt: action.doneAt,
    completedInRange: action.completedInRange,
    logs: action.logs,
    latestLog: action.latestLog,
  }));
  if (itemLogs.length === 0 && reportActions.length === 0) return null;

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? null,
    type: item.type,
    priority: item.priority,
    status: item.status,
    owner: item.owner ?? null,
    dueDate: item.dueDate ?? null,
    health: item.health,
    currentSummary: item.currentSummary ?? null,
    nextAction: item.nextAction ?? null,
    milestoneId: item.milestoneId ?? null,
    itemLogs,
    actionItems: reportActions,
  };
}

export function buildReportAggregate(input: ReportAggregatorInput, sources: ReportSourceProject[]): ReportAggregate {
  assertDateRange(input);
  const projectId = input.projectId || null;
  const projects: ReportProject[] = [];

  for (const project of sources) {
    if (projectId && project.id !== projectId) continue;
    const projectLogs = uniqueLogs(
      project.logs
        .filter((log) => inRange(log.workDate, input.startDate, input.endDate) && !log.itemId && !log.actionItemId)
        .map((log) => toReportLog(log, "project")),
    ).sort(byNewest);
    const reportItems = project.items
      .map((item) => toReportWorkItem(item, input))
      .filter((item): item is ReportWorkItem => Boolean(item));
    const itemsByMilestone = new Map<string, ReportWorkItem[]>();
    const projectItems: ReportWorkItem[] = [];

    for (const item of reportItems) {
      if (!item.milestoneId || !project.milestones.some((milestone) => milestone.id === item.milestoneId)) {
        projectItems.push(item);
        continue;
      }
      const existing = itemsByMilestone.get(item.milestoneId) ?? [];
      existing.push(item);
      itemsByMilestone.set(item.milestoneId, existing);
    }

    const milestones = project.milestones
      .map((milestone) => {
        const workItems = itemsByMilestone.get(milestone.id) ?? [];
        if (workItems.length === 0) return null;
        return {
          id: milestone.id,
          title: milestone.title,
          gateKey: milestone.gateKey ?? null,
          status: milestone.status,
          targetDate: asDateString(milestone.targetDate),
          actualDate: asDateString(milestone.actualDate),
          actualEndDate: asDateString(milestone.actualEndDate),
          workItems,
        };
      })
      .filter((milestone): milestone is ReportMilestone => Boolean(milestone));

    if (projectLogs.length === 0 && milestones.length === 0 && projectItems.length === 0) continue;
    projects.push({
      id: project.id,
      name: project.name,
      code: project.code ?? null,
      status: project.status,
      health: project.health,
      owner: project.owner ?? null,
      pm: project.pm ?? null,
      description: project.description ?? null,
      projectLogs,
      milestones,
      projectItems,
    });
  }

  const workItems = projects.flatMap((project) => [
    ...project.projectItems,
    ...project.milestones.flatMap((milestone) => milestone.workItems),
  ]);
  const actionItems = workItems.flatMap((item) => item.actionItems);
  const logs = [
    ...projects.flatMap((project) => [
      ...project.projectLogs,
      ...project.projectItems.flatMap((item) => [...item.itemLogs, ...item.actionItems.flatMap((action) => action.logs)]),
      ...project.milestones.flatMap((milestone) => milestone.workItems.flatMap((item) => [
        ...item.itemLogs,
        ...item.actionItems.flatMap((action) => action.logs),
      ])),
    ]),
  ];

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    projectId,
    projects,
    summary: {
      projects: projects.length,
      milestones: projects.reduce((count, project) => count + project.milestones.length, 0),
      workItems: workItems.length,
      actionItems: actionItems.length,
      logs: uniqueLogs(logs).length,
      systemLogs: uniqueLogs(logs).filter((log) => log.isSystemLog).length,
    },
  };
}

export async function aggregateReport(input: ReportAggregatorInput): Promise<ReportAggregate> {
  assertDateRange(input);
  const select = {
    id: true,
    name: true,
    code: true,
    status: true,
    health: true,
    owner: true,
    pm: true,
    description: true,
    logs: {
      where: { workDate: { gte: input.startDate, lte: input.endDate } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    },
    items: {
      orderBy: [{ updatedAt: "desc" }],
      include: {
        logs: { orderBy: [{ workDate: "desc" }, { createdAt: "desc" }] },
        actionItems: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { progressLogs: { orderBy: [{ workDate: "desc" }, { createdAt: "desc" }] } },
        },
        originWbsNode: { select: { kind: true } },
      },
    },
    milestones: {
      orderBy: [{ sortOrder: "asc" }, { targetDate: "asc" }],
      select: { id: true, title: true, gateKey: true, status: true, targetDate: true, actualDate: true, actualEndDate: true },
    },
  } satisfies Prisma.ProjectSelect;
  const projects = await prisma.project.findMany({
    where: input.projectId ? { id: input.projectId } : undefined,
    select,
  });
  return buildReportAggregate(input, projects as unknown as ReportSourceProject[]);
}
