import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionalYmdDate, requireText } from "@/lib/inputValidation";
import { getLocalDateString, toNullableString } from "@/lib/utils";

type ActionItemClient = Pick<Prisma.TransactionClient, "actionItem" | "workLog">;

type ActionItemContext = Prisma.ActionItemGetPayload<{
  include: {
    workItem: {
      select: {
        id: true;
        projectId: true;
        project: true;
        module: true;
        tags: true;
        sourceUrl: true;
        projectRef: { select: { name: true } };
      };
    };
  };
}>;

export class ActionItemWorkflowError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ActionItemWorkflowError";
  }
}

export function isActionItemWorkflowError(error: unknown): error is ActionItemWorkflowError {
  return error instanceof ActionItemWorkflowError;
}

export async function findActionItemContext(client: ActionItemClient | typeof prisma, id: string) {
  return client.actionItem.findUnique({
    where: { id },
    include: {
      workItem: {
        select: {
          id: true,
          projectId: true,
          project: true,
          module: true,
          tags: true,
          sourceUrl: true,
          projectRef: { select: { name: true } },
        },
      },
    },
  }) as Promise<ActionItemContext | null>;
}

function requireActionItemWorkItem(actionItem: ActionItemContext) {
  if (!actionItem.workItemId || !actionItem.workItem) {
    throw new ActionItemWorkflowError("该行动项未关联事项，无法使用 V3 主链路");
  }
  return actionItem.workItem;
}

export function buildActionItemProgressLogData(
  actionItem: ActionItemContext,
  input: { workDate: string; note: string; title?: string; type?: string },
): Prisma.WorkLogUncheckedCreateInput {
  const workItem = requireActionItemWorkItem(actionItem);
  const projectName = workItem.projectRef?.name || workItem.project || null;
  return {
    workDate: input.workDate,
    title: input.title || `行动项进展：${actionItem.title}`,
    content: input.note,
    note: input.note,
    type: input.type || "note",
    source: "manual",
    project: projectName,
    projectId: workItem.projectId,
    module: workItem.module,
    tags: workItem.tags,
    reportable: false,
    sourceUrl: workItem.sourceUrl,
    itemId: workItem.id,
    actionItemId: actionItem.id,
  };
}

function parseProgressInput(input: Record<string, unknown>) {
  const noteResult = requireText(input.note, "记录内容");
  const workDateResult = input.workDate === undefined
    ? { value: getLocalDateString() }
    : optionalYmdDate(input.workDate, "工作日期");
  if (noteResult.error) throw new ActionItemWorkflowError(noteResult.error);
  if (workDateResult.error) throw new ActionItemWorkflowError(workDateResult.error);
  if (!workDateResult.value) throw new ActionItemWorkflowError("工作日期不能为空");
  return { note: noteResult.value, workDate: workDateResult.value };
}

export async function addActionItemProgressLog(
  actionItemId: string,
  input: Record<string, unknown>,
) {
  const parsed = parseProgressInput(input);
  return prisma.$transaction(async (transaction) => {
    const actionItem = await findActionItemContext(transaction, actionItemId);
    if (!actionItem) throw new ActionItemWorkflowError("Action Item 不存在", 404);
    return transaction.workLog.create({
      data: buildActionItemProgressLogData(actionItem, parsed),
    });
  });
}

export async function rescheduleActionItem(
  actionItemId: string,
  input: Record<string, unknown>,
) {
  const dueDateResult = optionalYmdDate(input.dueDate, "dueDate");
  if (dueDateResult.error) throw new ActionItemWorkflowError(dueDateResult.error);
  const reason = toNullableString(input.reason)?.trim() || null;
  const nextStep = toNullableString(input.nextStep)?.trim() || null;
  if (!dueDateResult.value && input.dueDate !== null && input.dueDate !== "") {
    throw new ActionItemWorkflowError("dueDate 必须是有效日期或留空");
  }

  return prisma.$transaction(async (transaction) => {
    const actionItem = await findActionItemContext(transaction, actionItemId);
    if (!actionItem) throw new ActionItemWorkflowError("Action Item 不存在", 404);

    const today = getLocalDateString();
    const isOverdue = Boolean(
      actionItem.dueDate && actionItem.dueDate < today && actionItem.status !== "done",
    );
    const nextDueDate = dueDateResult.value;
    if (nextDueDate === actionItem.dueDate) {
      return { actionItem, log: null };
    }
    if (isOverdue && (!reason || !nextStep)) {
      throw new ActionItemWorkflowError("逾期调整计划必须填写延期原因和下一步");
    }

    const updated = await transaction.actionItem.update({
      where: { id: actionItemId },
      data: { dueDate: nextDueDate },
    });

    if (!isOverdue) return { actionItem: updated, log: null };

    const oldDate = actionItem.dueDate || "未设置";
    const newDate = nextDueDate || "未设置";
    const note = `计划调整：${oldDate} → ${newDate}\n原因：${reason}\n下一步：${nextStep}`;
    const log = await transaction.workLog.create({
      data: buildActionItemProgressLogData(actionItem, {
        workDate: today,
        note,
        title: `计划调整：${oldDate} → ${newDate}`,
        type: "update",
      }),
    });
    return { actionItem: updated, log };
  });
}

export async function completeActionItem(
  actionItemId: string,
  input: Record<string, unknown>,
) {
  const completionNote = toNullableString(input.completionNote ?? input.doneNote)?.trim() || null;
  return prisma.$transaction(async (transaction) => {
    const actionItem = await findActionItemContext(transaction, actionItemId);
    if (!actionItem) throw new ActionItemWorkflowError("Action Item 不存在", 404);
    if (actionItem.status === "done") return { actionItem, log: null };

    const updated = await transaction.actionItem.update({
      where: { id: actionItemId },
      data: { status: "done", doneAt: new Date(), doneNote: completionNote },
    });
    if (!completionNote) return { actionItem: updated, log: null };

    const log = await transaction.workLog.create({
      data: buildActionItemProgressLogData(actionItem, {
        workDate: getLocalDateString(),
        note: completionNote,
        title: `行动项完成：${actionItem.title}`,
        type: "update",
      }),
    });
    return { actionItem: updated, log };
  });
}
