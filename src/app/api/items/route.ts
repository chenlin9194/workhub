import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getLocalDateString,
  toNullableString,
} from "@/lib/utils";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  enumOrDefault,
  HEALTH_VALUES,
  normalizePage,
  optionalYmdDate,
  PRIORITY_VALUES,
  REPORT_LEVEL_VALUES,
  requireText,
  STATUS_VALUES,
  WORK_ITEM_TYPE_VALUES,
} from "@/lib/inputValidation";
import { buildReportQualityWhere, isReportQuality } from "@/lib/reportReadiness";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const project = searchParams.get("project");
    const moduleParam = searchParams.get("module");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility") || "open";
    const owner = searchParams.get("owner");
    const health = searchParams.get("health");
    const reportLevel = searchParams.get("reportLevel");
    const sourceSystem = searchParams.get("sourceSystem");
    const keyword = searchParams.get("keyword");
    const overdue = searchParams.get("overdue");
    const quality = searchParams.get("quality");
    const page = normalizePage(searchParams.get("page"));
    const pageSize = normalizePage(searchParams.get("pageSize"), 20, 100);

    const where: Record<string, unknown> = {};
    // AND clauses accumulated across multiple optional filters
    const andClauses: Record<string, unknown>[] = [];

    if (quality && !isReportQuality(quality)) return NextResponse.json({ error: "Invalid quality filter" }, { status: 400 });

    if (projectId) {
      where.projectId = projectId;
    } else if (project) {
      where.project = project;
    }
    if (moduleParam) where.module = moduleParam;
    if (type) where.type = type;
    if (priority) {
      const priorityValues = priority.split(",").map((value) => value.trim()).filter(Boolean);
      where.priority = priorityValues.length > 1 ? { in: priorityValues } : priorityValues[0] ?? priority;
    }
    if (owner) where.owner = owner;
    if (health) {
      const healthValues = health.split(",").map((value) => value.trim()).filter(Boolean);
      where.health = healthValues.length > 1 ? { in: healthValues } : healthValues[0] ?? health;
    }
    if (reportLevel) where.reportLevel = reportLevel;
    if (sourceSystem) where.sourceSystem = sourceSystem;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { currentSummary: { contains: keyword } },
        { trackingReason: { contains: keyword } },
        { module: { contains: keyword } },
        { owner: { contains: keyword } },
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
    if (quality) {
      if (!isReportQuality(quality)) return NextResponse.json({ error: "Invalid quality filter" }, { status: 400 });
      andClauses.push(buildReportQualityWhere(quality, getLocalDateString()));
    }
    if (status) {
      // Explicit status takes precedence over visibility.
      andClauses.push({ status });
    } else if (visibility === "closed") {
      andClauses.push({ status: "closed" });
    } else if (visibility === "open") {
      andClauses.push({ status: { not: "closed" } });
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

    const titleResult = requireText(title, "标题");
    const typeResult = enumOrDefault(type, WORK_ITEM_TYPE_VALUES, "事项类型", "action");
    const priorityResult = enumOrDefault(priority, PRIORITY_VALUES, "优先级", "P2");
    const statusResult = enumOrDefault(status, STATUS_VALUES, "状态", "open");
    const healthResult = enumOrDefault(health, HEALTH_VALUES, "健康度", "unknown");
    const reportLevelResult = enumOrDefault(reportLevel, REPORT_LEVEL_VALUES, "汇报层级", "none");
    const dueDateResult = optionalYmdDate(dueDate, "截止日期");
    const nextCheckpointResult = optionalYmdDate(nextCheckpoint, "下次检查");
    const validationError = [
      titleResult,
      typeResult,
      priorityResult,
      statusResult,
      healthResult,
      reportLevelResult,
      dueDateResult,
      nextCheckpointResult,
    ].find((result) => result.error)?.error;
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

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
        title: titleResult.value,
        description: toNullableString(description),
        project: projectName,
        projectId: projectId || null,
        module: toNullableString(mod),
        type: typeResult.value,
        priority: priorityResult.value,
        status: statusResult.value,
        owner: toNullableString(owner),
        dueDate: dueDateResult.value,
        nextAction: toNullableString(nextAction),
        tags: toNullableString(tags),
        trackingReason: toNullableString(trackingReason),
        sourceSystem: toNullableString(sourceSystem),
        sourceId: toNullableString(sourceId),
        sourceUrl: toNullableString(sourceUrl),
        health: healthResult.value,
        currentSummary: toNullableString(currentSummary),
        nextCheckpoint: nextCheckpointResult.value,
        reportLevel: reportLevelResult.value,
      },
    });

    revalidateWorkHubPaths({ itemId: item.id, projectId: item.projectId ?? undefined });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating work item:", error);
    return NextResponse.json({ error: "创建工作事项失败" }, { status: 500 });
  }
}
