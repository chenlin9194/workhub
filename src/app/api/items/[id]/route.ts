import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  toNullableString,
} from "@/lib/utils";
import {
  HEALTH_VALUES,
  optionalYmdDate,
  PRIORITY_VALUES,
  REPORT_LEVEL_VALUES,
  requireEnum,
  requireText,
  STATUS_VALUES,
  WORK_ITEM_TYPE_VALUES,
} from "@/lib/inputValidation";
import { updateWorkItemWithChangeLog } from "@/lib/workItemChangeLog";

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

    if (currentItem.managedBy === "wbs") {
      return NextResponse.json({ error: "WBS 系统事项状态由 WBS 执行节点派生，请在 WBS 页面维护" }, { status: 409 });
    }

    // Build update data - only include fields that are provided
    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const titleResult = requireText(body.title, "标题");
      if (titleResult.error) return NextResponse.json({ error: titleResult.error }, { status: 400 });
      data.title = titleResult.value;
    }
    if ("description" in body) data.description = toNullableString(body.description);
    if ("projectId" in body) {
      const nextProjectId = toNullableString(body.projectId);
      if (nextProjectId) {
        const project = await prisma.project.findUnique({
          where: { id: nextProjectId },
          select: { name: true },
        });

        if (!project) {
          return NextResponse.json({ error: "项目不存在" }, { status: 400 });
        }

        data.projectId = nextProjectId;
        data.project = project.name;
      } else {
        data.projectId = null;
        data.project = "project" in body ? toNullableString(body.project) : null;
      }
    } else if ("project" in body) {
      data.project = toNullableString(body.project);
    }
    if ("module" in body) data.module = toNullableString(body.module);
    if ("type" in body) {
      const result = requireEnum(body.type, WORK_ITEM_TYPE_VALUES, "事项类型");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.type = result.value;
    }
    if ("priority" in body) {
      const result = requireEnum(body.priority, PRIORITY_VALUES, "优先级");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.priority = result.value;
    }
    if ("status" in body) {
      const result = requireEnum(body.status, STATUS_VALUES, "状态");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.status = result.value;
    }
    if ("owner" in body) data.owner = toNullableString(body.owner);
    if ("dueDate" in body) {
      const result = optionalYmdDate(body.dueDate, "截止日期");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.dueDate = result.value;
    }
    if ("nextAction" in body) data.nextAction = toNullableString(body.nextAction);
    if ("tags" in body) data.tags = toNullableString(body.tags);
    if ("trackingReason" in body) data.trackingReason = toNullableString(body.trackingReason);
    if ("sourceSystem" in body) data.sourceSystem = toNullableString(body.sourceSystem);
    if ("sourceId" in body) data.sourceId = toNullableString(body.sourceId);
    if ("sourceUrl" in body) data.sourceUrl = toNullableString(body.sourceUrl);
    if ("health" in body) {
      const result = requireEnum(body.health, HEALTH_VALUES, "健康度");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.health = result.value;
    }
    if ("currentSummary" in body) data.currentSummary = toNullableString(body.currentSummary);
    if ("reportLevel" in body) {
      const result = requireEnum(body.reportLevel, REPORT_LEVEL_VALUES, "汇报层级");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.reportLevel = result.value;
    }

    if ("nextCheckpoint" in body) {
      const result = optionalYmdDate(body.nextCheckpoint, "下次检查");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.nextCheckpoint = result.value;
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

    const item = await updateWorkItemWithChangeLog(currentItem, body, data);

    revalidateWorkHubPaths({ itemId: id, projectId: item.projectId ?? undefined });
    if (currentItem.projectId && currentItem.projectId !== item.projectId) {
      revalidateWorkHubPaths({ projectId: currentItem.projectId });
    }

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
    const currentItem = await prisma.workItem.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!currentItem) {
      return NextResponse.json({ error: "工作事项不存在" }, { status: 404 });
    }

    const managedItem = await prisma.workItem.findUnique({ where: { id }, select: { managedBy: true } });
    if (managedItem?.managedBy === "wbs") {
      return NextResponse.json({ error: "WBS 系统事项不能通过普通事项接口删除" }, { status: 409 });
    }

    // First, unlink all associated work logs
    await prisma.$transaction([
      prisma.workLog.updateMany({
        where: { itemId: id },
        data: { itemId: null },
      }),
      prisma.workItem.delete({ where: { id } }),
    ]);

    revalidateWorkHubPaths({ itemId: id, projectId: currentItem.projectId ?? undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting work item:", error);
    return NextResponse.json({ error: "删除工作事项失败" }, { status: 500 });
  }
}
