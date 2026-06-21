import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const log = await prisma.workLog.findUnique({
      where: { id },
      include: { item: true },
    });

    if (!log) {
      return NextResponse.json({ error: "工作日志不存在" }, { status: 404 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error("Error fetching work log:", error);
    return NextResponse.json({ error: "获取工作日志失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { workDate, title, content, type, source, project, module, tags, itemId } = body;

    const log = await prisma.workLog.update({
      where: { id },
      data: {
        workDate,
        title,
        content,
        type,
        source,
        project,
        module,
        tags,
        itemId,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error("Error updating work log:", error);
    return NextResponse.json({ error: "更新工作日志失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.workLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting work log:", error);
    return NextResponse.json({ error: "删除工作日志失败" }, { status: 500 });
  }
}
