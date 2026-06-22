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
      <div className="export-page">
        <div className="export-header">
          <div><span className="section-eyebrow">FACT PACKAGE / RANGE</span><h1>日期范围导出</h1></div>
        </div>
        <div className="card export-notice">
          <div className="export-notice-icon">i</div>
          <div><strong>请提供导出日期范围</strong><p>在 URL 中加入 start 和 end 参数，日期格式为 YYYY-MM-DD。</p></div>
        </div>
        <div className="card export-preview export-range-help">
          <div className="export-preview-bar"><span><i className="preview-dot red" /><i className="preview-dot amber" /><i className="preview-dot green" /></span><span>range-query.txt</span><span>INPUT</span></div>
          <code>
            /export/range?start=2025-01-01&end=2025-01-07
          </code>
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

  // AI Prompt (at the top)
  md += `## AI 周报提示词\n\n`;
  md += `请根据以下本周工作数据，生成一份结构清晰的周报。要求：\n`;
  md += `1. 本周工作总结\n`;
  md += `2. 关键成果和里程碑\n`;
  md += `3. 风险和问题\n`;
  md += `4. 下周工作计划\n`;
  md += `5. 需要协调的事项\n\n`;

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

  return (
    <div className="export-page">
      <div className="export-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE / RANGE</span>
          <h1>工作汇总导出</h1>
          <p>{start} 至 {end}</p>
        </div>
        <CopyButton text={md} />
      </div>

      <div className="card export-notice">
        <div className="export-notice-icon">i</div>
        <div><strong>Work Hub 只导出事实，不调用 AI</strong><p>范围汇总已整理为 Markdown，可复制到外部工具中继续处理。</p></div>
        <span className="export-ready-tag"><i />Ready for Claude Code / Codex</span>
      </div>

      <div className="card export-preview">
        <div className="export-preview-bar"><span><i className="preview-dot red" /><i className="preview-dot amber" /><i className="preview-dot green" /></span><span>range-facts.md</span><span>MARKDOWN</span></div>
        <pre>{md}</pre>
      </div>
    </div>
  );
}
