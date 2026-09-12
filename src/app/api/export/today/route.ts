import { NextRequest, NextResponse } from "next/server";
import { aggregateReport } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";
import { getLocalDateString } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "markdown";
    const today = getLocalDateString();
    const report = await aggregateReport({ startDate: today, endDate: today, projectId: searchParams.get("projectId") });
    if (format === "json") return NextResponse.json({ date: today, report });
    return new NextResponse(generateReportMarkdown(report), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  } catch (error) {
    console.error("Error exporting today:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
