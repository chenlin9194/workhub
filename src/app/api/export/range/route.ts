import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRangeMarkdown } from "@/lib/export";
import { excludeClosedItemsFromUpdatedItems } from "@/lib/todayBuckets";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const format = searchParams.get("format") || "markdown";

    if (!start || !end) {
      return NextResponse.json({ error: "请提供 start 和 end 日期参数" }, { status: 400 });
    }

    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);

    const [workLogs, closedItems, rawUpdatedItems] = await Promise.all([
      prisma.workLog.findMany({
        where: { workDate: { gte: start, lte: end } },
        include: {
          item: { select: { id: true, title: true } },
          projectRef: { select: { id: true, name: true } },
        },
        orderBy: { workDate: "desc" },
      }),
      prisma.workItem.findMany({
        where: { closedAt: { gte: startDate, lt: endDate } },
        orderBy: { closedAt: "desc" },
      }),
      prisma.workItem.findMany({
        where: { updatedAt: { gte: startDate, lt: endDate } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const updatedItems = excludeClosedItemsFromUpdatedItems(closedItems, rawUpdatedItems);

    if (format === "json") {
      return NextResponse.json({
        start,
        end,
        workLogs,
        closedItems,
        updatedItems,
      });
    }

    const md = generateRangeMarkdown({ start, end, workLogs, closedItems, updatedItems });

    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error exporting range:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
