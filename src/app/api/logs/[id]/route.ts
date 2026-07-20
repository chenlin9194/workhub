import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateWorkHubPaths } from "@/lib/revalidate";
import { toNullableString } from "@/lib/utils";
import {
  LOG_SOURCE_VALUES,
  optionalYmdDate,
  requireEnum,
  requireText,
  WORK_LOG_TYPE_VALUES,
} from "@/lib/inputValidation";

function toBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

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
    const currentLog = await prisma.workLog.findUnique({ where: { id } });

    if (!currentLog) {
      return NextResponse.json({ error: "工作日志不存在" }, { status: 404 });
    }

    // Build update data - only include fields that are provided
    const data: Record<string, unknown> = {};

    if ("workDate" in body) {
      const result = optionalYmdDate(body.workDate, "工作日期");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      if (!result.value) return NextResponse.json({ error: "工作日期不能为空" }, { status: 400 });
      data.workDate = result.value;
    }
    if ("title" in body) {
      const result = requireText(body.title, "标题");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.title = result.value;
    }
    if ("content" in body) {
      const result = requireText(body.content, "内容");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.content = result.value;
    }
    if ("type" in body) {
      const result = requireEnum(body.type, WORK_LOG_TYPE_VALUES, "日志类型");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.type = result.value;
    }
    if ("source" in body) {
      const result = requireEnum(body.source, LOG_SOURCE_VALUES, "日志来源");
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      data.source = result.value;
    }
    if ("project" in body) data.project = toNullableString(body.project);
    if ("module" in body) data.module = toNullableString(body.module);
    if ("tags" in body) data.tags = toNullableString(body.tags);
    if ("itemId" in body) data.itemId = toNullableString(body.itemId);
    if ("reportable" in body) data.reportable = toBoolean(body.reportable);
    if ("sourceUrl" in body) data.sourceUrl = toNullableString(body.sourceUrl);

    const log = await prisma.workLog.update({
      where: { id },
      data,
    });

    revalidateWorkHubPaths({
      logId: id,
      itemId: currentLog.itemId ?? undefined,
      projectId: log.projectId ?? undefined,
    });
    if ("itemId" in body) {
      const nextItemId = body.itemId || undefined;
      if (nextItemId && nextItemId !== currentLog.itemId) {
        revalidateWorkHubPaths({ itemId: nextItemId });
      }
    }

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
    const currentLog = await prisma.workLog.findUnique({ where: { id } });

    if (!currentLog) {
      return NextResponse.json({ error: "工作日志不存在" }, { status: 404 });
    }

    await prisma.workLog.delete({ where: { id } });

    revalidateWorkHubPaths({ logId: id, itemId: currentLog.itemId ?? undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting work log:", error);
    return NextResponse.json({ error: "删除工作日志失败" }, { status: 500 });
  }
}
