import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayStart = new Date(today);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      totalItems,
      openItems,
      followingItems,
      blockedItems,
      closedItems,
      p0Items,
      p1Items,
      overdueItems,
      todayDueItems,
      totalLogs,
      todayLogs,
    ] = await Promise.all([
      prisma.workItem.count(),
      prisma.workItem.count({ where: { status: "open" } }),
      prisma.workItem.count({ where: { status: "following" } }),
      prisma.workItem.count({ where: { status: "blocked" } }),
      prisma.workItem.count({ where: { status: "closed" } }),
      prisma.workItem.count({ where: { priority: "P0", status: { not: "closed" } } }),
      prisma.workItem.count({ where: { priority: "P1", status: { not: "closed" } } }),
      prisma.workItem.count({ where: { dueDate: { lt: today }, status: { not: "closed" } } }),
      prisma.workItem.count({ where: { dueDate: today, status: { not: "closed" } } }),
      prisma.workLog.count(),
      prisma.workLog.count({ where: { workDate: today } }),
    ]);

    return NextResponse.json({
      items: {
        total: totalItems,
        open: openItems,
        following: followingItems,
        blocked: blockedItems,
        closed: closedItems,
        p0: p0Items,
        p1: p1Items,
        overdue: overdueItems,
        todayDue: todayDueItems,
      },
      logs: {
        total: totalLogs,
        today: todayLogs,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
