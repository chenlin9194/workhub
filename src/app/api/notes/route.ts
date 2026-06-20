import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notes - 列表 + 筛选
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // 筛选条件
    const project = searchParams.get("project");
    if (project) where.project = project;

    const moduleVal = searchParams.get("module");
    if (moduleVal) where.module = moduleVal;

    const type = searchParams.get("type");
    if (type) where.type = type;

    const priority = searchParams.get("priority");
    if (priority) where.priority = priority;

    const status = searchParams.get("status");
    if (status) where.status = status;

    const source = searchParams.get("source");
    if (source) where.source = source;

    const keyword = searchParams.get("keyword");
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
        { tags: { contains: keyword } },
      ];
    }

    // 日期范围
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate + "T00:00:00");
      if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59");
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.note.count({ where }),
    ]);

    return NextResponse.json({ notes, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return NextResponse.json(
      { error: "获取记录失败" },
      { status: 500 }
    );
  }
}

// POST /api/notes - 创建
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: {
        title: body.title.trim(),
        content: body.content.trim(),
        project: body.project?.trim() || null,
        module: body.module?.trim() || null,
        type: body.type || "note",
        priority: body.priority || "P2",
        status: body.status || "open",
        owner: body.owner?.trim() || null,
        dueDate: body.dueDate || null,
        source: body.source || "manual",
        tags: body.tags?.trim() || null,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return NextResponse.json(
      { error: "创建记录失败" },
      { status: 500 }
    );
  }
}
