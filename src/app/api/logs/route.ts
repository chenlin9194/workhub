import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, toNullableString } from "@/lib/utils";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import {
  enumOrDefault,
  LOG_SOURCE_VALUES,
  normalizePage,
  optionalYmdDate,
  requireText,
  WORK_LOG_TYPE_VALUES,
} from "@/lib/inputValidation";

function toBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const projectId = searchParams.get("projectId");
    const project = searchParams.get("project");
    const itemId = searchParams.get("itemId");
    const moduleParam = searchParams.get("module");
    const type = searchParams.get("type");
    const source = searchParams.get("source");
    const hasItem = searchParams.get("hasItem");
    const reportable = searchParams.get("reportable");
    const view = searchParams.get("view");
    const keyword = searchParams.get("keyword");
    const page = normalizePage(searchParams.get("page"));
    const pageSize = normalizePage(searchParams.get("pageSize"), 20, 100);
    const startDateResult = optionalYmdDate(startDate, "开始日期");
    const endDateResult = optionalYmdDate(endDate, "结束日期");
    const dateError = startDateResult.error || endDateResult.error;
    if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });
    if (startDateResult.value && endDateResult.value && startDateResult.value > endDateResult.value) {
      return NextResponse.json({ error: "开始日期不能晚于结束日期" }, { status: 400 });
    }

    const where: Record<string, unknown> = {};
    const andClauses: Record<string, unknown>[] = [];

    if (startDateResult.value || endDateResult.value) {
      where.workDate = {};
      if (startDateResult.value) (where.workDate as Record<string, string>).gte = startDateResult.value;
      if (endDateResult.value) (where.workDate as Record<string, string>).lte = endDateResult.value;
    }
    if (projectId) {
      andClauses.push({
        OR: [{ projectId }, { item: { projectId } }],
      });
    } else if (project) {
      where.project = project;
    }
    if (itemId) {
      andClauses.push({ itemId });
    }
    if (moduleParam) where.module = moduleParam;
    if (type) where.type = type;
    if (source) where.source = source;
    if (hasItem === "true") andClauses.push({ itemId: { not: null } });
    if (hasItem === "false") andClauses.push({ itemId: null });
    if (reportable === "true") where.reportable = true;
    if (reportable === "false") where.reportable = false;
    if (view === "facts") {
      andClauses.push({
        OR: [
          { reportable: true },
          { type: { in: ["risk", "blocker", "decision", "issue"] } },
        ],
      });
    }
    if (view === "risk_blocker") {
      andClauses.push({ type: { in: ["risk", "blocker"] } });
    }
    if (view === "system") {
      andClauses.push({
        AND: [
          { type: "update" },
          { title: { startsWith: "事项变化：" } },
        ],
      });
    }
    if (keyword) {
      andClauses.push({
        OR: [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
          { sourceUrl: { contains: keyword } },
        ],
      });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const [logs, total] = await Promise.all([
      prisma.workLog.findMany({
        where,
        include: { item: true },
        orderBy: { workDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching work logs:", error);
    return NextResponse.json({ error: "获取工作日志失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workDate, title, content, type, source, project, projectId, module: mod, tags, itemId, reportable, sourceUrl } = body;

    const titleResult = requireText(title, "标题");
    const contentResult = requireText(content, "内容");
    const workDateResult = workDate === undefined
      ? { value: getLocalDateString() }
      : optionalYmdDate(workDate, "工作日期");
    const typeResult = enumOrDefault(type, WORK_LOG_TYPE_VALUES, "日志类型", "note");
    const sourceResult = enumOrDefault(source, LOG_SOURCE_VALUES, "日志来源", "manual");
    const validationError = [titleResult, contentResult, workDateResult, typeResult, sourceResult]
      .find((result) => result.error)?.error;
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    if (!workDateResult.value) return NextResponse.json({ error: "工作日期不能为空" }, { status: 400 });

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

    const log = await prisma.workLog.create({
      data: {
        workDate: workDateResult.value,
        title: titleResult.value,
        content: contentResult.value,
        type: typeResult.value,
        source: sourceResult.value,
        project: projectName,
        projectId: projectId || null,
        module: toNullableString(mod),
        tags: toNullableString(tags),
        itemId: itemId || null,
        reportable: toBoolean(reportable),
        sourceUrl: toNullableString(sourceUrl),
      },
    });

    revalidateWorkHubPaths({
      logId: log.id,
      itemId: itemId || undefined,
      projectId: log.projectId ?? undefined,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating work log:", error);
    return NextResponse.json({ error: "创建工作日志失败" }, { status: 500 });
  }
}
