import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    if ("description" in body) data.description = body.description === "" ? null : body.description;
    if ("project" in body) data.project = body.project === "" ? null : body.project;
    if ("module" in body) data.module = body.module === "" ? null : body.module;
    if ("type" in body) data.type = body.type;
    if ("priority" in body) data.priority = body.priority;
    if ("status" in body) data.status = body.status;
    if ("owner" in body) data.owner = body.owner === "" ? null : body.owner;
    if ("dueDate" in body) data.dueDate = body.dueDate === "" ? null : body.dueDate;
    if ("nextAction" in body) data.nextAction = body.nextAction === "" ? null : body.nextAction;
    if ("tags" in body) data.tags = body.tags === "" ? null : body.tags;

    // Handle closedAt logic
    if ("status" in body) {
      const newStatus = body.status;
      if (newStatus === "closed" && currentItem.status !== "closed") {
        data.closedAt = new Date();
      } else if (newStatus !== "closed" && currentItem.status === "closed") {
        data.closedAt = null;
      }
    }

    const item = await prisma.workItem.update({
      where: { id },
      data,
    });

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting work item:", error);
    return NextResponse.json({ error: "删除工作事项失败" }, { status: 500 });
  }
}
