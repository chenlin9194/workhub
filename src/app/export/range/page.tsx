import { prisma } from "@/lib/prisma";
import { WORK_LOG_TYPE_LABELS, WORK_ITEM_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function ExportRangePage({ searchParams }: PageProps) {
  const { start, end } = await searchParams;

  if (!start || !end) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>日期范围导出</h1>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>请在 URL 中提供 start 和 end 参数：</p>
          <code style={{ display: "block", padding: 16, background: "var(--bg-secondary)", borderRadius: 8, fontSize: 14 }}>
            /export/range?start=2025-01-01&end=2025-01-07
          </code>
          <p style={{ color: "var(--text-tertiary)", marginTop: 16, fontSize: 13 }}>日期格式：YYYY-MM-DD</p>
        </div>
      </div>
    );
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() + 1);

  const [logs, closedItems, updatedItems] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: { gte: start, lte: end } },
      include: { item: { select: { id: true, title: true } } },
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

  // 一、工作日志
  if (dates.length > 0) {
    md += `## 一、工作日志\n\n`;
    dates.forEach((date) => {
      md += `### ${date}\n\n`;
      logsByDate[date].forEach((log) => {
        md += `#### ${log.title}\n`;
        md += `- 日期: ${log.workDate} | 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
        if (log.project) md += `- 项目: ${log.project}`;
        if (log.module) md += ` | 模块: ${log.module}`;
        if (log.project || log.module) md += "\n";
        if (log.tags) md += `- 标签: ${log.tags}\n`;
        if (log.item) md += `- 关联事项: ${log.item.title}\n`;
        md += `\n${log.content}\n\n`;
      });
    });
  }

  // 二、关闭事项
  if (closedItems.length > 0) {
    md += `## 二、关闭事项\n\n`;
    closedItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority}\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.closedAt) md += `- 关闭时间: ${item.closedAt.toISOString().split("T")[0]}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 三、更新事项
  if (updatedItems.length > 0) {
    md += `## 三、更新事项\n\n`;
    updatedItems.forEach((item) => {
      md += `- **${item.title}** - ${STATUS_LABELS[item.status] || item.status} (${PRIORITY_LABELS[item.priority] || item.priority})\n`;
    });
    md += "\n";
  }

  // AI Prompt
  md += `---\n\n`;
  md += `## AI 提示词\n\n`;
  md += `请根据以上工作内容，生成一份周报。要求：\n`;
  md += `1. 本周工作总结\n`;
  md += `2. 关键成果和里程碑\n`;
  md += `3. 风险和问题\n`;
  md += `4. 下周工作计划\n`;
  md += `5. 需要协调的事项\n`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>工作汇总导出</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>{start} 至 {end}</p>
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
