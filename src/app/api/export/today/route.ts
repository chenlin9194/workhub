import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, getTodayRange } from "@/lib/utils";
import { generateTodayMarkdown } from "@/lib/export";
import { excludeClosedItemsFromUpdatedItems } from "@/lib/todayBuckets";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "markdown";
    const today = getLocalDateString();
    const { start: todayStart, end: todayEnd } = getTodayRange();

    const [
      workLogs,
      closedItems,
      rawUpdatedItems,
      openHighPriorityItems,
      dueTodayItems,
      overdueItems,
      riskAndBlockerLogs,
      decisionLogs,
    ] = await Promise.all([
      prisma.workLog.findMany({
        where: { workDate: today },
        include: {
          item: { select: { id: true, title: true } },
          projectRef: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.workItem.findMany({
        where: { closedAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { closedAt: "desc" },
      }),
      prisma.workItem.findMany({
        where: { updatedAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workItem.findMany({
        where: { priority: { in: ["P0", "P1"] }, status: { not: "closed" } },
        orderBy: { priority: "asc" },
      }),
      prisma.workItem.findMany({
        where: { dueDate: today, status: { not: "closed" } },
        orderBy: { priority: "asc" },
      }),
      prisma.workItem.findMany({
        where: { dueDate: { lt: today }, status: { not: "closed" } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.workLog.findMany({
        where: { workDate: today, type: { in: ["risk", "blocker"] } },
        include: {
          item: { select: { id: true, title: true } },
          projectRef: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.workLog.findMany({
        where: { workDate: today, type: "decision" },
        include: {
          item: { select: { id: true, title: true } },
          projectRef: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const updatedItems = excludeClosedItemsFromUpdatedItems(closedItems, rawUpdatedItems);

    if (format === "json") {
      return NextResponse.json({
        date: today,
        workLogs,
        closedItems,
        updatedItems,
        openHighPriorityItems,
        dueTodayItems,
        overdueItems,
        riskAndBlockerLogs,
        decisionLogs,
      });
    }

    const md = generateTodayMarkdown({
      today,
      workLogs,
      closedItems,
      updatedItems,
      openHighPriorityItems,
      dueTodayItems,
      overdueItems,
      riskAndBlockerLogs,
      decisionLogs,
    });

    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error exporting today:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
