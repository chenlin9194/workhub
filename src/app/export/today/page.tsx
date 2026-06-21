import { prisma } from "@/lib/prisma";
import { getTodayStr, formatTodayStr } from "@/lib/utils";
import { WORK_LOG_TYPE_LABELS, WORK_ITEM_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function ExportTodayPage() {
  const today = getTodayStr();
  const todayStart = new Date(today);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    todayLogs,
    todayClosedItems,
    todayUpdatedItems,
    p0p1Items,
    todayDueItems,
    overdueItems,
  ] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: today },
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
  ]);

  // Generate Markdown
  let md = `# 今日工作汇总 - ${today}\n\n`;

  md += `## 概览\n\n`;
  md += `- 今日新增日志: ${todayLogs.length} 条\n`;
  md += `- 今日关闭事项: ${todayClosedItems.length} 项\n`;
  md += `- 今日更新事项: ${todayUpdatedItems.length} 项\n`;
  md += `- P0/P1 未关闭: ${p0p1Items.length} 项\n`;
  md += `- 今日到期: ${todayDueItems.length} 项\n`;
  md += `- 逾期未关闭: ${overdueItems.length} 项\n\n`;

  if (todayLogs.length > 0) {
    md += `## 今日日志\n\n`;
    todayLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  if (p0p1Items.length > 0) {
    md += `## P0/P1 未关闭事项\n\n`;
    p0p1Items.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      md += `\n`;
    });
  }

  if (todayDueItems.length > 0) {
    md += `## 今日到期事项\n\n`;
    todayDueItems.forEach((item) => {
      md += `- **${item.title}** (${PRIORITY_LABELS[item.priority] || item.priority})\n`;
    });
    md += `\n`;
  }

  if (overdueItems.length > 0) {
    md += `## 逾期未关闭事项\n\n`;
    overdueItems.forEach((item) => {
      md += `- **${item.title}** - 截止: ${item.dueDate} (${PRIORITY_LABELS[item.priority] || item.priority})\n`;
    });
    md += `\n`;
  }

  if (todayClosedItems.length > 0) {
    md += `## 今日关闭事项\n\n`;
    todayClosedItems.forEach((item) => {
      md += `- **${item.title}** (${WORK_ITEM_TYPE_LABELS[item.type] || item.type})\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## AI 提示词\n\n`;
  md += `请根据以上今日工作内容，生成一份简洁的日报。要求：\n`;
  md += `1. 总结今日主要工作成果\n`;
  md += `2. 列出关键决策和风险\n`;
  md += `3. 明日工作计划\n`;
  md += `4. 需要协调的事项\n`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>今日工作导出</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>{formatTodayStr()}</p>
        </div>
        <CopyButton text={md} />
      </div>

      <div className="card" style={{ padding: 24 }}>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)" }}>
          {md}
        </pre>
      </div>
    </div>
  );
}
