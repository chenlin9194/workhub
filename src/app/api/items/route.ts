import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getLocalDateString,
  normalizeOptionalYmdDateString,
  toNullableString,
} from "@/lib/utils";
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
    const health = searchParams.get("health");
    const reportLevel = searchParams.get("reportLevel");
    const sourceSystem = searchParams.get("sourceSystem");
    const keyword = searchParams.get("keyword");
    const overdue = searchParams.get("overdue");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};
    // AND clauses accumulated across multiple optional filters
    const andClauses: Record<string, unknown>[] = [];

    if (project) where.project = project;
    if (moduleParam) where.module = moduleParam;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (owner) where.owner = owner;
    if (health) where.health = health;
    if (reportLevel) where.reportLevel = reportLevel;
    if (sourceSystem) where.sourceSystem = sourceSystem;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { currentSummary: { contains: keyword } },
        { trackingReason: { contains: keyword } },
        { sourceId: { contains: keyword } },
      ];
    }
    if (overdue === "true") {
      // Overdue: dueDate is in the past and item is not closed.
      // We use AND clauses so this can coexist with the explicit `status` filter below.
      const today = getLocalDateString();
      where.dueDate = { lt: today };
      andClauses.push({ status: { not: "closed" } });
    }
    // Apply explicit status filter after overdue check so both conditions are respected
    if (status) {
      andClauses.push({ status });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
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
    const {
      title,
      description,
      project,
      projectId,
      module: mod,
      type,
      priority,
      status,
      owner,
      dueDate,
      nextAction,
      tags,
      trackingReason,
      sourceSystem,
      sourceId,
      sourceUrl,
      health,
      currentSummary,
      nextCheckpoint,
      reportLevel,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }

    const nextCheckpointResult = normalizeOptionalYmdDateString(nextCheckpoint);
    if (nextCheckpointResult.error) {
      return NextResponse.json({ error: nextCheckpointResult.error }, { status: 400 });
    }

    // Resolve project name from projectId if provided
    let projectName = toNullableString(project);
    if (projectId) {
      const proj = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      if (!proj) {
        return NextResponse.json({ error: "项目不存在" }, { status: 400 });
      }
      projectName = proj.name;
    }

    const item = await prisma.workItem.create({
      data: {
        title,
        description: toNullableString(description),
        project: projectName,
        projectId: projectId || null,
        module: toNullableString(mod),
        type: type || "action",
        priority: priority || "P2",
        status: status || "open",
        owner: toNullableString(owner),
        dueDate: toNullableString(dueDate),
        nextAction: toNullableString(nextAction),
        tags: toNullableString(tags),
        trackingReason: toNullableString(trackingReason),
        sourceSystem: toNullableString(sourceSystem),
        sourceId: toNullableString(sourceId),
        sourceUrl: toNullableString(sourceUrl),
        health: health == null || health === "" ? "unknown" : health,
        currentSummary: toNullableString(currentSummary),
        nextCheckpoint: nextCheckpointResult.value,
        reportLevel: reportLevel == null || reportLevel === "" ? "none" : reportLevel,
      },
    });

    revalidateWorkHubPaths({ itemId: item.id });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating work item:", error);
    return NextResponse.json({ error: "创建工作事项失败" }, { status: 500 });
  }
}
