import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notes/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = await prisma.note.findUnique({ where: { id } });

    if (!note) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error("GET /api/notes/[id] error:", error);
    return NextResponse.json({ error: "获取记录失败" }, { status: 500 });
  }
}

// PUT /api/notes/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    if (body.content !== undefined && !body.content?.trim()) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        title: body.title?.trim(),
        content: body.content?.trim(),
        project: body.project?.trim() || null,
        module: body.module?.trim() || null,
        type: body.type,
        priority: body.priority,
        status: body.status,
        owner: body.owner?.trim() || null,
        dueDate: body.dueDate || null,
        source: body.source,
        tags: body.tags?.trim() || null,
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("PUT /api/notes/[id] error:", error);
    return NextResponse.json({ error: "更新记录失败" }, { status: 500 });
  }
}

// DELETE /api/notes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/notes/[id] error:", error);
    return NextResponse.json({ error: "删除记录失败" }, { status: 500 });
  }
}
