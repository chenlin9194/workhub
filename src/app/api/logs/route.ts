import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/utils";
import { revalidateWorkHubPaths } from "@/lib/revalidate";

function toNullableString(value: unknown): string | null {
  return value === "" || value === undefined || value === null ? null : String(value);
}

function toBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const project = searchParams.get("project");
    const moduleParam = searchParams.get("module");
    const type = searchParams.get("type");
    const source = searchParams.get("source");
    const hasItem = searchParams.get("hasItem");
    const reportable = searchParams.get("reportable");
    const keyword = searchParams.get("keyword");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) (where.workDate as Record<string, string>).gte = startDate;
      if (endDate) (where.workDate as Record<string, string>).lte = endDate;
    }
    if (project) where.project = project;
    if (moduleParam) where.module = moduleParam;
    if (type) where.type = type;
    if (source) where.source = source;
    if (hasItem === "true") where.itemId = { not: null };
    if (hasItem === "false") where.itemId = null;
    if (reportable === "true") where.reportable = true;
    if (reportable === "false") where.reportable = false;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
        { sourceUrl: { contains: keyword } },
      ];
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
    const { workDate, title, content, type, source, project, module: mod, tags, itemId, reportable, sourceUrl } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
    }

    const log = await prisma.workLog.create({
      data: {
        workDate: workDate || getLocalDateString(),
        title,
        content,
        type: type || "note",
        source: source || "manual",
        project: toNullableString(project),
        module: toNullableString(mod),
        tags: toNullableString(tags),
        itemId: itemId || null,
        reportable: toBoolean(reportable),
        sourceUrl: toNullableString(sourceUrl),
      },
    });

    revalidateWorkHubPaths({ logId: log.id, itemId: itemId || undefined });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating work log:", error);
    return NextResponse.json({ error: "创建工作日志失败" }, { status: 500 });
  }
}
