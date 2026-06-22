import { prisma } from "@/lib/prisma";
import { getLocalDateString, formatTodayStr } from "@/lib/utils";
import { WORK_LOG_TYPE_LABELS, WORK_ITEM_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function ExportTodayPage() {
  const today = getLocalDateString();
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
    riskAndBlockerLogs,
    decisionLogs,
  ] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: today },
      include: { item: { select: { id: true, title: true } } },
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
      include: { item: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workLog.findMany({
      where: { workDate: today, type: "decision" },
      include: { item: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Generate Markdown
  let md = `# 今日工作汇总 - ${today}\n\n`;

  // AI Prompt (at the top)
  md += `## AI 日报提示词\n\n`;
  md += `请根据以下今日工作数据，生成一份简洁的日报。要求：\n`;
  md += `1. 总结今日主要工作成果\n`;
  md += `2. 列出关键决策和风险\n`;
  md += `3. 明日工作计划\n`;
  md += `4. 需要协调的事项\n\n`;

  // Overview
  md += `## 概览\n\n`;
  md += `- 今日新增日志: ${todayLogs.length} 条\n`;
  md += `- 今日关闭事项: ${todayClosedItems.length} 项\n`;
  md += `- 今日更新事项: ${todayUpdatedItems.length} 项\n`;
  md += `- P0/P1 未关闭: ${p0p1Items.length} 项\n`;
  md += `- 今日到期: ${todayDueItems.length} 项\n`;
  md += `- 逾期未关闭: ${overdueItems.length} 项\n\n`;

  // 一、今日新增日志
  if (todayLogs.length > 0) {
    md += `## 一、今日新增日志\n\n`;
    todayLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 日期: ${log.workDate} | 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}`;
      if (log.module) md += ` | 模块: ${log.module}`;
      if (log.project || log.module) md += "\n";
      if (log.tags) md += `- 标签: ${log.tags}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  // 二、今日关闭事项
  if (todayClosedItems.length > 0) {
    md += `## 二、今日关闭事项\n\n`;
    todayClosedItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
      if (item.tags) md += `- 标签: ${item.tags}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 三、今日更新事项
  if (todayUpdatedItems.length > 0) {
    md += `## 三、今日更新事项\n\n`;
    todayUpdatedItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
      if (item.tags) md += `- 标签: ${item.tags}\n`;
      md += "\n";
    });
  }

  // 四、当前 P0/P1 未关闭事项
  if (p0p1Items.length > 0) {
    md += `## 四、当前 P0/P1 未关闭事项\n\n`;
    p0p1Items.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
      if (item.tags) md += `- 标签: ${item.tags}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 五、今日到期事项
  if (todayDueItems.length > 0) {
    md += `## 五、今日到期事项\n\n`;
    todayDueItems.forEach((item) => {
      md += `- **${item.title}** (${PRIORITY_LABELS[item.priority] || item.priority}) - ${STATUS_LABELS[item.status] || item.status}`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      md += "\n";
    });
    md += "\n";
  }

  // 六、逾期未关闭事项
  if (overdueItems.length > 0) {
    md += `## 六、逾期未关闭事项\n\n`;
    overdueItems.forEach((item) => {
      md += `- **${item.title}** - 截止: ${item.dueDate} (${PRIORITY_LABELS[item.priority] || item.priority}) - ${STATUS_LABELS[item.status] || item.status}`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      md += "\n";
    });
    md += "\n";
  }

  // 七、今日风险/阻塞
  if (riskAndBlockerLogs.length > 0) {
    md += `## 七、今日风险/阻塞\n\n`;
    riskAndBlockerLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  // 八、今日决策
  if (decisionLogs.length > 0) {
    md += `## 八、今日决策\n\n`;
    decisionLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  return (
    <div className="export-page">
      <div className="export-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE / TODAY</span>
          <h1>今日工作导出</h1>
          <p>{formatTodayStr()}</p>
        </div>
        <CopyButton text={md} />
      </div>

      <div className="card export-notice">
        <div className="export-notice-icon">i</div>
        <div>
          <strong>Work Hub 只导出事实，不调用 AI</strong>
          <p>此页面整理今日事实记录，可复制到外部 Claude Code / Codex 中生成日报。</p>
        </div>
        <span className="export-ready-tag"><i />Ready for Claude Code / Codex</span>
      </div>

      <div className="card export-preview">
        <div className="export-preview-bar">
          <span><i className="preview-dot red" /><i className="preview-dot amber" /><i className="preview-dot green" /></span>
          <span>daily-facts.md</span>
          <span>MARKDOWN</span>
        </div>
        <pre>{md}</pre>
      </div>
    </div>
  );
}
