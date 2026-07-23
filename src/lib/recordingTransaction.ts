import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveActionItemDoneNote } from "@/lib/actionItemCompletion";
import {
  ACTION_ITEM_STATUS_VALUES,
  enumOrDefault,
  HEALTH_VALUES,
  LOG_SOURCE_VALUES,
  optionalYmdDate,
  PRIORITY_VALUES,
  REPORT_LEVEL_VALUES,
  requireText,
  STATUS_VALUES,
  WORK_ITEM_TYPE_VALUES,
  WORK_LOG_TYPE_VALUES,
} from "@/lib/inputValidation";
import { getLocalDateString, toNullableString } from "@/lib/utils";

type TransactionClient = Pick<Prisma.TransactionClient, "actionItem" | "workItem" | "workLog">;

type ActionItemInput = {
  title: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  sortOrder: number;
  doneNote: string | null;
};

type CreateWorkItemInput = {
  title: string;
  description: string | null;
  project: string | null;
  projectId: string | null;
  module: string | null;
  type: string;
  priority: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  nextAction: string | null;
  tags: string | null;
  trackingReason: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  health: string;
  currentSummary: string | null;
  nextCheckpoint: string | null;
  reportLevel: string;
};

type CreateWorkLogInput = {
  workDate: string;
  title: string;
  content: string;
  type: string;
  source: string;
  project: string | null;
  projectId: string | null;
  module: string | null;
  tags: string | null;
  reportable: boolean;
  sourceUrl: string | null;
};

export class CompositeInputError extends Error {}

function errorIfInvalid(results: Array<{ error?: string }>) {
  const message = results.find((result) => result.error)?.error;
  if (message) throw new CompositeInputError(message);
}

function toBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseSortOrder(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseActionItems(value: unknown): ActionItemInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new CompositeInputError("行动项必须是列表");

  return value.map((raw, index) => {
    if (typeof raw === "string") {
      const titleResult = requireText(raw, `第 ${index + 1} 条行动项标题`);
      errorIfInvalid([titleResult]);
      return {
        title: titleResult.value,
        status: "pending",
        owner: null,
        dueDate: null,
        sortOrder: index,
        doneNote: null,
      };
    }
    if (!raw || typeof raw !== "object") throw new CompositeInputError(`第 ${index + 1} 条行动项无效`);
    const input = raw as Record<string, unknown>;
    const titleResult = requireText(input.title, `第 ${index + 1} 条行动项标题`);
    const statusResult = enumOrDefault(input.status, ACTION_ITEM_STATUS_VALUES, "行动项状态", "pending");
    const dueDateResult = optionalYmdDate(input.dueDate, "行动项截止日期");
    const doneNoteResult = resolveActionItemDoneNote(statusResult.value, input.doneNote, `第 ${index + 1} 条行动项完成结论`);
    errorIfInvalid([titleResult, statusResult, dueDateResult, doneNoteResult]);

    return {
      title: titleResult.value,
      status: statusResult.value,
      owner: toNullableString(input.owner),
      dueDate: dueDateResult.value,
      sortOrder: parseSortOrder(input.sortOrder, index),
      doneNote: doneNoteResult.value ?? null,
    };
  });
}

function parseWorkItem(input: Record<string, unknown>): CreateWorkItemInput {
  const titleResult = requireText(input.title, "事项标题");
  const typeResult = enumOrDefault(input.type, WORK_ITEM_TYPE_VALUES, "事项类型", "action");
  const priorityResult = enumOrDefault(input.priority, PRIORITY_VALUES, "优先级", "P2");
  const statusResult = enumOrDefault(input.status, STATUS_VALUES, "状态", "open");
  const healthResult = enumOrDefault(input.health, HEALTH_VALUES, "健康度", "unknown");
  const reportLevelResult = enumOrDefault(input.reportLevel, REPORT_LEVEL_VALUES, "汇报层级", "none");
  const dueDateResult = optionalYmdDate(input.dueDate, "截止日期");
  const nextCheckpointResult = optionalYmdDate(input.nextCheckpoint, "下次检查点");
  errorIfInvalid([
    titleResult,
    typeResult,
    priorityResult,
    statusResult,
    healthResult,
    reportLevelResult,
    dueDateResult,
    nextCheckpointResult,
  ]);

  return {
    title: titleResult.value,
    description: toNullableString(input.description),
    project: toNullableString(input.project),
    projectId: toNullableString(input.projectId),
    module: toNullableString(input.module),
    type: typeResult.value,
    priority: priorityResult.value,
    status: statusResult.value,
    owner: toNullableString(input.owner),
    dueDate: dueDateResult.value,
    nextAction: toNullableString(input.nextAction),
    tags: toNullableString(input.tags),
    trackingReason: toNullableString(input.trackingReason),
    sourceSystem: toNullableString(input.sourceSystem),
    sourceId: toNullableString(input.sourceId),
    sourceUrl: toNullableString(input.sourceUrl),
    health: healthResult.value,
    currentSummary: toNullableString(input.currentSummary),
    nextCheckpoint: nextCheckpointResult.value,
    reportLevel: reportLevelResult.value,
  };
}

function parseWorkLog(input: Record<string, unknown>, defaultSource: string): CreateWorkLogInput {
  const titleResult = requireText(input.title, "日志标题");
  const contentResult = requireText(input.content, "日志内容");
  const workDateResult = input.workDate === undefined
    ? { value: getLocalDateString() }
    : optionalYmdDate(input.workDate, "工作日期");
  const typeResult = enumOrDefault(input.type, WORK_LOG_TYPE_VALUES, "日志类型", "note");
  const sourceResult = enumOrDefault(input.source, LOG_SOURCE_VALUES, "日志来源", defaultSource);
  errorIfInvalid([titleResult, contentResult, workDateResult, typeResult, sourceResult]);
  if (!workDateResult.value) throw new CompositeInputError("工作日期不能为空");

  return {
    workDate: workDateResult.value,
    title: titleResult.value,
    content: contentResult.value,
    type: typeResult.value,
    source: sourceResult.value,
    project: toNullableString(input.project),
    projectId: toNullableString(input.projectId),
    module: toNullableString(input.module),
    tags: toNullableString(input.tags),
    reportable: toBoolean(input.reportable),
    sourceUrl: toNullableString(input.sourceUrl),
  };
}

async function resolveProject(projectId: string | null, projectName: string | null) {
  if (!projectId) return { projectId: null, project: projectName };

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) throw new CompositeInputError("项目不存在");
  return { projectId: project.id, project: project.name };
}

async function resolveExistingItem(itemId: string | null) {
  if (!itemId) return null;
  const item = await prisma.workItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      projectId: true,
      project: true,
      projectRef: { select: { name: true } },
    },
  });
  if (!item) throw new CompositeInputError("事项不存在");
  return { ...item, project: item.projectRef?.name || item.project };
}

type ProjectContext = {
  projectId: string | null;
  project: string | null;
};

export function resolveFinalProjectContext({
  requestedProject,
  existingItem,
  newItemProject,
}: {
  requestedProject: ProjectContext;
  existingItem: ProjectContext | null;
  newItemProject: ProjectContext;
}) {
  if (existingItem?.projectId && requestedProject.projectId && existingItem.projectId !== requestedProject.projectId) {
    throw new CompositeInputError("事项与日志项目不一致");
  }
  if (newItemProject.projectId && requestedProject.projectId && newItemProject.projectId !== requestedProject.projectId) {
    throw new CompositeInputError("新建事项与日志项目不一致");
  }

  if (requestedProject.projectId) return requestedProject;
  if (existingItem?.projectId) return existingItem;
  if (newItemProject.projectId) return newItemProject;

  return {
    projectId: null,
    project: requestedProject.project || existingItem?.project || newItemProject.project || null,
  };
}

async function createActionItems(
  transaction: TransactionClient,
  actionInputs: ActionItemInput[],
  relations: { projectId: string | null; workItemId?: string | null; workLogId?: string | null }
) {
  return Promise.all(
    actionInputs.map((action) =>
      transaction.actionItem.create({
        data: {
          title: action.title,
          status: action.status,
          owner: action.owner,
          dueDate: action.dueDate,
          sortOrder: action.sortOrder,
          doneAt: action.status === "done" ? new Date() : null,
          doneNote: action.doneNote,
          projectId: relations.projectId,
          workItemId: relations.workItemId ?? null,
          workLogId: relations.workLogId ?? null,
        },
      })
    )
  );
}

export async function createWorkItemWithActions(input: Record<string, unknown>) {
  const itemInput = parseWorkItem(input);
  const actionInputs = parseActionItems(input.actionItems);
  const project = await resolveProject(itemInput.projectId, itemInput.project);

  return prisma.$transaction(async (transaction) => {
    const item = await transaction.workItem.create({
      data: { ...itemInput, projectId: project.projectId, project: project.project },
    });
    const actionItems = await createActionItems(transaction, actionInputs, {
      projectId: item.projectId,
      workItemId: item.id,
    });
    return { item, actionItems };
  });
}

export async function createWorkLogWithContext(
  input: Record<string, unknown>,
  options: { defaultSource?: string; requireItemContext?: boolean } = {}
) {
  const logInput = parseWorkLog(input, options.defaultSource || "manual");
  const actionInputs = parseActionItems(input.actionItems);
  const existingItemId = toNullableString(input.itemId);
  const newItemRaw = input.newItem;
  const hasNewItem = Boolean(newItemRaw && typeof newItemRaw === "object");

  if (existingItemId && hasNewItem) throw new CompositeInputError("只能关联已有事项或新建事项之一");
  if (options.requireItemContext && !existingItemId && !hasNewItem) {
    throw new CompositeInputError("请选择已有事项或填写新建事项");
  }
  if (newItemRaw !== undefined && !hasNewItem) throw new CompositeInputError("新建事项无效");

  const existingItem = await resolveExistingItem(existingItemId);
  const newItemInput = hasNewItem ? parseWorkItem(newItemRaw as Record<string, unknown>) : null;
  const requestedProject = await resolveProject(logInput.projectId, logInput.project);
  const newItemProject = newItemInput
    ? await resolveProject(newItemInput.projectId, newItemInput.project)
    : { projectId: null, project: null };

  const finalProject = resolveFinalProjectContext({
    requestedProject,
    existingItem: existingItem
      ? { projectId: existingItem.projectId, project: existingItem.project }
      : null,
    newItemProject,
  });
  const { projectId, project: projectName } = finalProject;

  return prisma.$transaction(async (transaction) => {
    const item = newItemInput
      ? await transaction.workItem.create({
          data: { ...newItemInput, projectId, project: projectName },
        })
      : null;
    const workItemId = existingItem?.id || item?.id || null;
    const log = await transaction.workLog.create({
      data: {
        ...logInput,
        projectId,
        project: projectName,
        itemId: workItemId,
      },
    });
    const actionItems = await createActionItems(transaction, actionInputs, {
      projectId,
      workItemId,
      workLogId: log.id,
    });
    return { item, log, actionItems };
  });
}

export function isCompositeInputError(error: unknown): error is CompositeInputError {
  return error instanceof CompositeInputError;
}
