import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNullableString } from "@/lib/utils";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import { ACTION_ITEM_STATUS_VALUES, optionalYmdDate, requireText } from "@/lib/inputValidation";

const VALID_STATUSES = ACTION_ITEM_STATUS_VALUES;

function parseOptionalSortOrder(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStatus(value: unknown, fallback: string) {
  const status = value === undefined || value === null || value === "" ? fallback : String(value);
  if (!VALID_STATUSES.has(status)) {
    return { status: fallback, error: "Invalid action item status" };
  }
  return { status };
}

function applyRelationFilters(where: Record<string, unknown>, workItemId: string | null, workLogId: string | null, projectId: string | null) {
  if (workItemId) where.workItemId = workItemId;
  if (workLogId) where.workLogId = workLogId;
  if (projectId) where.projectId = projectId;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workItemId = searchParams.get("workItemId");
    const workLogId = searchParams.get("workLogId");
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid action item status" }, { status: 400 });
    }

    const hasRelationFilter = Boolean(workItemId || workLogId || projectId);
    const where: Record<string, unknown> = {};

    if (hasRelationFilter) {
      applyRelationFilters(where, workItemId, workLogId, projectId);
    }

    if (status) {
      where.status = status;
    }

    if (!hasRelationFilter && !status) {
      return NextResponse.json({ actionItems: [] });
    }

    const actionItems = await prisma.actionItem.findMany({
      where,
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({ actionItems });
  } catch (error) {
    console.error("Error fetching action items:", error);
    return NextResponse.json({ error: "Failed to fetch action items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const titleResult = requireText(body.title, "Action Item 标题");
    const workItemId = toNullableString(body.workItemId);
    const workLogId = toNullableString(body.workLogId);
    const projectId = toNullableString(body.projectId);
    const statusResult = parseStatus(body.status, "pending");
    const dueDateResult = optionalYmdDate(body.dueDate, "dueDate");

    if (titleResult.error) return NextResponse.json({ error: titleResult.error }, { status: 400 });

    if (statusResult.error) {
      return NextResponse.json({ error: statusResult.error }, { status: 400 });
    }

    if (dueDateResult.error) {
      return NextResponse.json({ error: dueDateResult.error }, { status: 400 });
    }

    if (!workItemId && !workLogId) {
      return NextResponse.json({ error: "Action Item 需要关联事项或日志" }, { status: 400 });
    }

    const [workItem, workLog, project] = await Promise.all([
      workItemId
        ? prisma.workItem.findUnique({ where: { id: workItemId }, select: { id: true, projectId: true } })
        : Promise.resolve(null),
      workLogId
        ? prisma.workLog.findUnique({ where: { id: workLogId }, select: { id: true, projectId: true } })
        : Promise.resolve(null),
      projectId
        ? prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    if (workItemId && !workItem) {
      return NextResponse.json({ error: "事项不存在" }, { status: 400 });
    }

    if (workLogId && !workLog) {
      return NextResponse.json({ error: "日志不存在" }, { status: 400 });
    }

    if (projectId && !project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 400 });
    }

    if (projectId && workItem?.projectId && workItem.projectId !== projectId) {
      return NextResponse.json({ error: "Action Item 项目与事项项目不一致" }, { status: 400 });
    }

    if (projectId && workLog?.projectId && workLog.projectId !== projectId) {
      return NextResponse.json({ error: "Action Item 项目与日志项目不一致" }, { status: 400 });
    }

    const resolvedProjectId = projectId || workLog?.projectId || workItem?.projectId || null;
    const doneAt = statusResult.status === "done" ? new Date() : null;

    const actionItem = await prisma.actionItem.create({
      data: {
        title: titleResult.value,
        status: statusResult.status,
        owner: toNullableString(body.owner),
        dueDate: dueDateResult.value,
        sortOrder: parseOptionalSortOrder(body.sortOrder),
        workItemId,
        workLogId,
        projectId: resolvedProjectId,
        doneAt,
        doneNote: toNullableString(body.doneNote),
      },
    });

    revalidateWorkHubPaths({
      itemId: workItemId || undefined,
      logId: workLogId || undefined,
      projectId: resolvedProjectId || undefined,
    });

    return NextResponse.json(actionItem, { status: 201 });
  } catch (error) {
    console.error("Error creating action item:", error);
    return NextResponse.json({ error: "创建 Action Item 失败" }, { status: 500 });
  }
}
