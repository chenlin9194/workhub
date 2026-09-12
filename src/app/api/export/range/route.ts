import { NextRequest, NextResponse } from "next/server";
import { aggregateReport } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";
import { isValidYmdDateString } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const format = searchParams.get("format") || "markdown";
    if (!isValidYmdDateString(startDate) || !isValidYmdDateString(endDate) || startDate > endDate) {
      return NextResponse.json({ error: "请提供有效的 start 和 end 日期参数" }, { status: 400 });
    }
    const report = await aggregateReport({ startDate, endDate, projectId: searchParams.get("projectId") });
    if (format === "json") return NextResponse.json({ start: startDate, end: endDate, report });
    return new NextResponse(generateReportMarkdown(report), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  } catch (error) {
    console.error("Error exporting range:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
