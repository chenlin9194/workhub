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
    const { title, description, project, module, type, priority, status, owner, dueDate, nextAction, tags } = body;

    // Get current item to check status change
    const currentItem = await prisma.workItem.findUnique({ where: { id } });

    if (!currentItem) {
      return NextResponse.json({ error: "工作事项不存在" }, { status: 404 });
    }

    // Handle closedAt logic
    let closedAt = currentItem.closedAt;
    if (status === "closed" && currentItem.status !== "closed") {
      closedAt = new Date();
    } else if (status !== "closed" && currentItem.status === "closed") {
      closedAt = null;
    }

    const item = await prisma.workItem.update({
      where: { id },
      data: {
        title,
        description,
        project,
        module,
        type,
        priority,
        status,
        owner,
        dueDate,
        nextAction,
        tags,
        closedAt,
      },
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
