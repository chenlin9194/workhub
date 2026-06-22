import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/utils";
import { revalidateWorkHubPaths } from "@/lib/revalidate";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const project = searchParams.get("project");
    const moduleParam = searchParams.get("module");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const status = searchParams.get("status");
    const owner = searchParams.get("owner");
    const keyword = searchParams.get("keyword");
    const overdue = searchParams.get("overdue");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (project) where.project = project;
    if (moduleParam) where.module = moduleParam;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (owner) where.owner = owner;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    if (overdue === "true") {
      const today = getLocalDateString();
      where.dueDate = { lt: today };
      where.status = { not: "closed" };
    }

    const [items, total] = await Promise.all([
      prisma.workItem.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workItem.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching work items:", error);
    return NextResponse.json({ error: "获取工作事项失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, project, module: mod, type, priority, status, owner, dueDate, nextAction, tags } = body;

    if (!title) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }

    const item = await prisma.workItem.create({
      data: {
        title,
        description,
        project,
        module: mod,
        type: type || "task",
        priority: priority || "P2",
        status: status || "open",
        owner,
        dueDate,
        nextAction,
        tags,
      },
    });

    revalidateWorkHubPaths({ itemId: item.id });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating work item:", error);
    return NextResponse.json({ error: "创建工作事项失败" }, { status: 500 });
  }
}
