import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WORK_ITEM_TYPE_LABELS, WORK_LOG_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const format = searchParams.get("format") || "markdown";

    if (!start || !end) {
      return NextResponse.json({ error: "请提供 start 和 end 日期参数" }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 1);

    const [
      logs,
      closedItems,
      updatedItems,
    ] = await Promise.all([
      prisma.workLog.findMany({
        where: {
          workDate: { gte: start, lte: end },
        },
        orderBy: { workDate: "desc" },
      }),
      prisma.workItem.findMany({
        where: {
          closedAt: { gte: startDate, lt: endDate },
        },
        orderBy: { closedAt: "desc" },
      }),
      prisma.workItem.findMany({
        where: {
          updatedAt: { gte: startDate, lt: endDate },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    if (format === "json") {
      return NextResponse.json({
        start,
        end,
        logs,
        closedItems,
        updatedItems,
      });
    }

    // Generate Markdown
    let md = `# 工作汇总 - ${start} 至 ${end}\n\n`;

    // Summary
    md += `## 概览\n\n`;
    md += `- 日志数量: ${logs.length} 条\n`;
    md += `- 关闭事项: ${closedItems.length} 项\n`;
    md += `- 更新事项: ${updatedItems.length} 项\n\n`;

    // Group logs by date
    const logsByDate = logs.reduce((acc, log) => {
      if (!acc[log.workDate]) {
        acc[log.workDate] = [];
      }
      acc[log.workDate].push(log);
      return acc;
    }, {} as Record<string, typeof logs>);

    const dates = Object.keys(logsByDate).sort((a, b) => b.localeCompare(a));

    // Logs by date
    if (dates.length > 0) {
      md += `## 工作日志\n\n`;
      dates.forEach((date) => {
        md += `### ${date}\n\n`;
        logsByDate[date].forEach((log) => {
          md += `#### ${log.title}\n`;
          md += `- 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
          if (log.project) md += `- 项目: ${log.project}\n`;
          md += `\n${log.content}\n\n`;
        });
      });
    }

    // Closed Items
    if (closedItems.length > 0) {
      md += `## 关闭事项\n\n`;
      closedItems.forEach((item) => {
        md += `- **${item.title}** (${WORK_ITEM_TYPE_LABELS[item.type] || item.type}) - 关闭于 ${item.closedAt?.toISOString().split("T")[0]}\n`;
      });
      md += `\n`;
    }

    // Prompt for AI
    md += `---\n\n`;
    md += `## AI 提示词\n\n`;
    md += `请根据以上工作内容，生成一份周报。要求：\n`;
    md += `1. 本周工作总结\n`;
    md += `2. 关键成果和里程碑\n`;
    md += `3. 风险和问题\n`;
    md += `4. 下周工作计划\n`;
    md += `5. 需要协调的事项\n`;

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
