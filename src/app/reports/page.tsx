import Link from "next/link";
import Icon from "@/components/Icon";
import CopyButton from "@/components/CopyButton";
import WbsReportFacts from "@/components/WbsReportFacts";
import { aggregateReport, type ReportActionItem, type ReportLog, type ReportWorkItem } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, getWeekRange, isValidYmdDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; projectId?: string }>;
}

function getMonthRange(today: string) {
  const [year, month] = today.split("-").map(Number);
  const end = new Date(year, month, 0);
  return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: getLocalDateString(end) };
}

function getReportRange(params: { preset?: string; start?: string; end?: string }) {
  const today = getLocalDateString();
  if (params.preset === "week") return getWeekRange();
  if (params.preset === "month") return getMonthRange(today);
  if (params.preset === "custom" && isValidYmdDateString(params.start) && isValidYmdDateString(params.end) && params.start <= params.end) {
    return { start: params.start, end: params.end };
  }
  return { start: today, end: today };
}

function logText(log: ReportLog) {
  return log.note?.trim() || log.content.trim() || log.title;
}

function actionState(action: ReportActionItem) {
  const fields = [action.status];
  if (action.owner) fields.push(`负责人：${action.owner}`);
  if (action.dueDate) fields.push(`截止：${action.dueDate}`);
  if (action.completedInRange) fields.push("本期完成");
  return fields.join(" · ");
}

function ActionItemReport({ action }: { action: ReportActionItem }) {
  return (
    <div className="report-action-item">
      <div className="report-tree-row"><strong>{action.title}</strong><span>{actionState(action)}</span></div>
      {action.logs.length > 0 ? (
        <div className="report-log-list report-log-list--action">
          {action.logs.map((log) => <Link key={log.id} href={`/logs/${log.id}`} className="report-log-row"><span>{log.workDate}</span><small>行动项进展</small><p>{logText(log)}</p></Link>)}
        </div>
      ) : action.latestLog ? (
        <div className="report-latest-note">最近进展（{action.latestLog.workDate}）：{logText(action.latestLog)}</div>
      ) : null}
    </div>
  );
}

function WorkItemReport({ item }: { item: ReportWorkItem }) {
  const visibleItemLogs = item.itemLogs.filter((log) => !log.isSystemLog);
  const hiddenSystemCount = item.itemLogs.filter((log) => log.isSystemLog).length;
  return (
    <article className="report-work-item">
      <div className="report-tree-row report-tree-row--item"><Link href={`/items/${item.id}`}><strong>{item.title}</strong></Link><span>{item.status} · {item.priority} · {item.health}</span></div>
      <div className="report-item-meta">{item.owner && <span>负责人：{item.owner}</span>}{item.dueDate && <span>截止：{item.dueDate}</span>}{item.currentSummary && <span>当前：{item.currentSummary}</span>}{item.nextAction && <span>下一步：{item.nextAction}</span>}</div>
      {visibleItemLogs.length > 0 && <div className="report-log-list">{visibleItemLogs.map((log) => <Link key={log.id} href={`/logs/${log.id}`} className="report-log-row"><span>{log.workDate}</span><small>事项记录</small><p>{logText(log)}</p></Link>)}</div>}
      {hiddenSystemCount > 0 && <div className="report-system-note">已保留 {hiddenSystemCount} 条历史系统变化日志，正文不展开。</div>}
      {item.actionItems.length > 0 && <div className="report-action-list"><div className="report-subsection-label">行动项</div>{item.actionItems.map((action) => <ActionItemReport key={action.id} action={action} />)}</div>}
    </article>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const range = getReportRange(params);
  const projectId = params.projectId || null;
  const [report, projects] = await Promise.all([
    aggregateReport({ startDate: range.start, endDate: range.end, projectId }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const markdown = generateReportMarkdown(report);
  const preset = params.preset || "today";
  const queryFor = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const values = { preset, projectId: projectId || undefined, ...next };
    Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value); });
    return `/reports?${query.toString()}`;
  };
  const totalVisibleLogs = report.summary.logs - report.summary.systemLogs;

  return (
    <div className="page-shell auxiliary-page reports-page report-workbench-page">
      <header className="command-page-header reports-header"><div><span className="section-eyebrow">REPORT AGGREGATOR V3</span><h1>汇报入口</h1><p>按项目 → STR/里程碑 → 事项 → 行动项 → 日志阅读同一份事实聚合，不按 reportable 筛选，也不从标题推断 STR。</p></div><div className="page-header-actions"><CopyButton text={markdown} label="复制 Markdown 事实包" successLabel="已复制" variant="primary" /></div></header>
      <section className="card report-filter-panel"><div className="report-filter-presets"><Link className={`btn ${preset === "today" ? "btn-primary" : "btn-secondary"}`} href={queryFor({ preset: "today", start: undefined, end: undefined })}>今天</Link><Link className={`btn ${preset === "week" ? "btn-primary" : "btn-secondary"}`} href={queryFor({ preset: "week", start: undefined, end: undefined })}>本周</Link><Link className={`btn ${preset === "month" ? "btn-primary" : "btn-secondary"}`} href={queryFor({ preset: "month", start: undefined, end: undefined })}>本月</Link></div><form className="report-filter-form" action="/reports"><input type="hidden" name="preset" value="custom" /><label><span>开始日期</span><input name="start" type="date" defaultValue={range.start} required /></label><label><span>结束日期</span><input name="end" type="date" defaultValue={range.end} required /></label><label><span>项目</span><select name="projectId" defaultValue={projectId || ""}><option value="">全部项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button className="btn btn-secondary" type="submit">应用范围</button></form></section>
      <section className="report-summary-strip"><div><strong>{range.start} 至 {range.end}</strong><span>时间范围</span></div><div><strong>{report.summary.projects}</strong><span>项目</span></div><div><strong>{report.summary.workItems}</strong><span>事项</span></div><div><strong>{report.summary.actionItems}</strong><span>行动项</span></div><div><strong>{totalVisibleLogs}</strong><span>正文日志</span></div></section>
      <section className="report-secondary-links report-secondary-links--header"><Link href={queryFor({ preset: "today", start: undefined, end: undefined })} className="btn btn-secondary"><Icon name="calendar" size={14} />今日聚合</Link><Link href={`/export/range?start=${range.start}&end=${range.end}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`} className="btn btn-secondary"><Icon name="download" size={14} />Markdown 导出</Link><Link href="/projects" className="btn btn-secondary"><Icon name="folder" size={14} />项目</Link></section>
      {report.projects.length === 0 ? <div className="card report-quiet-empty">该范围内暂无已关联项目的事项、行动项或日志事实。</div> : report.projects.map((project) => <section key={project.id} className="card report-project-tree"><div className="dashboard-section-title"><div><span className="section-eyebrow">PROJECT</span><h2>{project.name}</h2></div><span>{project.status} · {project.health}</span></div>{project.projectLogs.length > 0 && <div className="report-project-log-context"><div className="report-subsection-label">项目记录</div>{project.projectLogs.filter((log) => !log.isSystemLog).map((log) => <Link key={log.id} href={`/logs/${log.id}`} className="report-log-row"><span>{log.workDate}</span><small>项目记录</small><p>{logText(log)}</p></Link>)}</div>}{project.milestones.map((milestone) => <div key={milestone.id} className="report-milestone-block"><div className="report-milestone-heading"><strong>STR/里程碑：{milestone.title}</strong><span>{milestone.status}{milestone.targetDate ? ` · 目标 ${milestone.targetDate}` : ""}</span></div>{milestone.workItems.map((item) => <WorkItemReport key={item.id} item={item} />)}</div>)}{project.projectItems.length > 0 && <div className="report-milestone-block"><div className="report-milestone-heading"><strong>未归属 STR / 项目级事项</strong><span>不根据标题推断</span></div>{project.projectItems.map((item) => <WorkItemReport key={item.id} item={item} />)}</div>}</section>)}
      <section className="card report-draft-panel"><div className="export-preview-bar report-draft-bar"><span>report-facts.md</span><span>MARKDOWN</span><CopyButton text={markdown} label="复制事实包" successLabel="已复制" variant="primary" /></div><pre>{markdown}</pre></section>
      <WbsReportFacts />
    </div>
  );
}
