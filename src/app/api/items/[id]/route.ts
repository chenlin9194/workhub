import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  getLocalDateString,
  normalizeOptionalYmdDateString,
  toNullableString,
} from "@/lib/utils";

const TRACKED_FIELDS = [
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

type TrackedField = (typeof TRACKED_FIELDS)[number];

const TRACKED_FIELD_LABELS: Record<TrackedField, string> = {
  status: "状态",
  priority: "优先级",
  health: "健康度",
  currentSummary: "当前结论",
  nextAction: "下一步行动",
  nextCheckpoint: "下次检查",
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await prisma.workItem.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { workDate: "desc" },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "工作事项不存在" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching work item:", error);
    return NextResponse.json({ error: "获取工作事项失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get current item
    const currentItem = await prisma.workItem.findUnique({ where: { id } });

    if (!currentItem) {
      return NextResponse.json({ error: "工作事项不存在" }, { status: 404 });
    }

    // Build update data - only include fields that are provided
    const data: Record<string, unknown> = {};

    if ("title" in body) data.title = body.title;
    if ("description" in body) data.description = toNullableString(body.description);
    if ("project" in body) data.project = toNullableString(body.project);
    if ("module" in body) data.module = toNullableString(body.module);
    if ("type" in body) data.type = body.type;
    if ("priority" in body) data.priority = body.priority;
    if ("status" in body) data.status = body.status;
    if ("owner" in body) data.owner = toNullableString(body.owner);
    if ("dueDate" in body) data.dueDate = toNullableString(body.dueDate);
    if ("nextAction" in body) data.nextAction = toNullableString(body.nextAction);
    if ("tags" in body) data.tags = toNullableString(body.tags);
    if ("trackingReason" in body) data.trackingReason = toNullableString(body.trackingReason);
    if ("sourceSystem" in body) data.sourceSystem = toNullableString(body.sourceSystem);
    if ("sourceId" in body) data.sourceId = toNullableString(body.sourceId);
    if ("sourceUrl" in body) data.sourceUrl = toNullableString(body.sourceUrl);
    if ("health" in body) data.health = body.health == null || body.health === "" ? "unknown" : body.health;
    if ("currentSummary" in body) data.currentSummary = toNullableString(body.currentSummary);
    if ("reportLevel" in body) data.reportLevel = body.reportLevel == null || body.reportLevel === "" ? "none" : body.reportLevel;

    if ("nextCheckpoint" in body) {
      const nextCheckpointResult = normalizeOptionalYmdDateString(body.nextCheckpoint);
      if (nextCheckpointResult.error) {
        return NextResponse.json({ error: nextCheckpointResult.error }, { status: 400 });
      }
      data.nextCheckpoint = nextCheckpointResult.value;
    }

    // Handle closedAt logic
    if ("status" in body) {
      const newStatus = body.status;
      if (newStatus === "closed" && currentItem.status !== "closed") {
        data.closedAt = new Date();
      } else if (newStatus !== "closed" && currentItem.status === "closed") {
        data.closedAt = null;
      }
    }

    const changes = TRACKED_FIELDS.flatMap((field) => {
      if (!(field in body)) return [];

      const before = currentItem[field];
      const after = data[field];
      if (before === after) return [];

      return [{ field, before, after }];
    });

    const item = await prisma.workItem.update({
      where: { id },
      data,
    });

    if (changes.length > 0) {
      try {
        let logType = "update";
        if (changes.some(({ field }) => field === "health") && item.health === "red") {
          logType = "risk";
        }
        if (changes.some(({ field }) => field === "status") && item.status === "blocked") {
          logType = "blocker";
        }

        await prisma.workLog.create({
          data: {
            workDate: getLocalDateString(),
            title: `事项变化：${item.title}`,
            content: changes
              .map(
                ({ field, before }) =>
                  `${TRACKED_FIELD_LABELS[field]}：${formatChangeValue(before)} → ${formatChangeValue(item[field])}`
              )
              .join("\n"),
            type: logType,
            source: "manual",
            project: item.project,
            module: item.module,
            tags: item.tags,
            itemId: item.id,
            reportable: changes.some(({ field }) => REPORTABLE_FIELDS.has(field)),
            sourceUrl: item.sourceUrl,
          },
        });
      } catch (logError) {
        console.error("Error creating work item change log:", logError);
      }
    }

    revalidateWorkHubPaths({ itemId: id });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating work item:", error);
    return NextResponse.json({ error: "更新工作事项失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First, unlink all associated work logs
    await prisma.workLog.updateMany({
      where: { itemId: id },
      data: { itemId: null },
    });

    // Then delete the work item
    await prisma.workItem.delete({ where: { id } });

    revalidateWorkHubPaths({ itemId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting work item:", error);
    return NextResponse.json({ error: "删除工作事项失败" }, { status: 500 });
  }
}
