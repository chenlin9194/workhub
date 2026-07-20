import { Prisma, type WorkItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/utils";

export const WORK_ITEM_TRACKED_FIELDS = [
  "status",
  "priority",
  "health",
  "currentSummary",
  "nextAction",
  "nextCheckpoint",
  "reportLevel",
  "owner",
  "dueDate",
  "sourceSystem",
  "sourceId",
  "sourceUrl",
] as const;

type TrackedField = (typeof WORK_ITEM_TRACKED_FIELDS)[number];

type WorkItemChange = {
  field: TrackedField;
  before: WorkItem[TrackedField];
  after: unknown;
};

type WorkItemChangeLogClient = Pick<Prisma.TransactionClient, "workLog">;

const TRACKED_FIELD_LABELS: Record<TrackedField, string> = {
  status: "状态",
  priority: "优先级",
  health: "健康度",
  currentSummary: "当前结论",
  nextAction: "下一步行动",
  nextCheckpoint: "下次检查点",
  reportLevel: "汇报层级",
  owner: "责任人",
  dueDate: "截止日期",
  sourceSystem: "来源系统",
  sourceId: "来源编号",
  sourceUrl: "来源链接",
};

const REPORTABLE_FIELDS = new Set<TrackedField>([
  "health",
  "currentSummary",
  "nextAction",
  "nextCheckpoint",
  "reportLevel",
  "status",
]);

function formatChangeValue(value: unknown): string {
  return value === null || value === undefined || value === "" ? "空" : String(value);
}

export function collectWorkItemChanges(
  currentItem: WorkItem,
  patch: Record<string, unknown>,
  data: Record<string, unknown>
): WorkItemChange[] {
  return WORK_ITEM_TRACKED_FIELDS.flatMap((field) => {
    if (!(field in patch)) return [];

    const before = currentItem[field];
    const after = data[field];
    if (before === after) return [];

    return [{ field, before, after }];
  });
}

export async function createWorkItemChangeLog(
  client: WorkItemChangeLogClient,
  item: WorkItem,
  changes: WorkItemChange[]
) {
  if (changes.length === 0) return;

  let logType = "update";
  if (changes.some(({ field }) => field === "health") && item.health === "red") {
    logType = "risk";
  }
  if (changes.some(({ field }) => field === "status") && item.status === "blocked") {
    logType = "blocker";
  }

  await client.workLog.create({
    data: {
      workDate: getLocalDateString(),
      title: `事项变化：${item.title}`,
      content: changes
        .map(
          ({ field, before }) =>
            `${TRACKED_FIELD_LABELS[field]}：${formatChangeValue(before)} ⇒ ${formatChangeValue(item[field])}`
        )
        .join("\n"),
      type: logType,
      source: "manual",
      project: item.project,
      projectId: item.projectId,
      module: item.module,
      tags: item.tags,
      itemId: item.id,
      reportable: changes.some(({ field }) => REPORTABLE_FIELDS.has(field)),
      sourceUrl: item.sourceUrl,
    },
  });
}

export async function updateWorkItemWithChangeLog(
  currentItem: WorkItem,
  patch: Record<string, unknown>,
  data: Record<string, unknown>
) {
  const changes = collectWorkItemChanges(currentItem, patch, data);

  return prisma.$transaction(async (transaction) => {
    const item = await transaction.workItem.update({
      where: { id: currentItem.id },
      data: data as Prisma.WorkItemUpdateInput,
    });

    if (changes.length > 0) {
      await createWorkItemChangeLog(transaction, item, changes);
    }

    return item;
  });
}
