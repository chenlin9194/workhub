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

    // Build update data - only include fields that are provided
    const data: Record<string, unknown> = {};

    if ("workDate" in body) data.workDate = body.workDate;
    if ("title" in body) data.title = body.title;
    if ("content" in body) data.content = body.content;
    if ("type" in body) data.type = body.type;
    if ("source" in body) data.source = body.source;
    if ("project" in body) data.project = body.project === "" ? null : body.project;
    if ("module" in body) data.module = body.module === "" ? null : body.module;
    if ("tags" in body) data.tags = body.tags === "" ? null : body.tags;
    if ("itemId" in body) data.itemId = body.itemId === "" ? null : body.itemId;

    const log = await prisma.workLog.update({
      where: { id },
      data,
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
