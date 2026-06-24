import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function toNullableString(value: unknown): string | null {
  return value === "" || value === undefined || value === null ? null : String(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get("keyword");
    const status = searchParams.get("status");
    const health = searchParams.get("health");
    const type = searchParams.get("type");
    const owner = searchParams.get("owner");
    const pm = searchParams.get("pm");
    const stage = searchParams.get("stage");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (health) where.health = health;
    if (type) where.type = type;
    if (owner) where.owner = owner;
    if (pm) where.pm = pm;
    if (stage) where.stage = stage;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { description: { contains: keyword } },
        { currentSummary: { contains: keyword } },
        { tags: { contains: keyword } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: { items: true, logs: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      projects,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "获取项目列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      description,
      type,
      status,
      stage,
      health,
      owner,
      pm,
      startDate,
      targetDate,
      releaseDate,
      currentSummary,
      nextMilestone,
      nextAction,
      sourceSystem,
      sourceId,
      sourceUrl,
      tags,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        code: toNullableString(code),
        description: toNullableString(description),
        type: type || "project",
        status: status || "active",
        stage: toNullableString(stage),
        health: health || "unknown",
        owner: toNullableString(owner),
        pm: toNullableString(pm),
        startDate: startDate ? new Date(`${startDate}T00:00:00`) : null,
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00`) : null,
        releaseDate: releaseDate ? new Date(`${releaseDate}T00:00:00`) : null,
        currentSummary: toNullableString(currentSummary),
        nextMilestone: toNullableString(nextMilestone),
        nextAction: toNullableString(nextAction),
        sourceSystem: toNullableString(sourceSystem),
        sourceId: toNullableString(sourceId),
        sourceUrl: toNullableString(sourceUrl),
        tags: toNullableString(tags),
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }
}
