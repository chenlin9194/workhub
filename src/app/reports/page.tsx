import Link from "next/link";
import Icon from "@/components/Icon";
import CopyButton from "@/components/CopyButton";
import WbsReportFacts from "@/components/WbsReportFacts";
import { aggregateReport, type ReportActionItem, type ReportLog, type ReportWorkItem } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, getWeekRange, isValidYmdDateString } from "@/lib/utils";
import { ACTION_ITEM_STATUS_LABELS, HEALTH_LABELS, PRIORITY_LABELS, PROJECT_MILESTONE_STATUS_LABELS, PROJECT_STATUS_LABELS, STATUS_LABELS } from "@/lib/constants";

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

function isOpenAction(action: ReportActionItem) {
  return action.status !== "done" && action.status !== "closed";
}

function isOverdueAction(action: ReportActionItem, today: string) {
  return isOpenAction(action) && Boolean(action.dueDate && action.dueDate < today);
}

function ActionItemReport({ action, today }: { action: ReportActionItem; today: string }) {
  const overdue = isOverdueAction(action, today);
  const completed = !isOpenAction(action);
  return (
    <div className={`report-action-item${completed ? " is-done" : " is-open"}${overdue ? " is-overdue" : ""}`}>
      <div className="report-action-item-head">
        <div className="report-tree-row"><strong>{action.title}</strong></div>
        <span className="report-action-state">{overdue ? "逾期 · " : ""}{ACTION_ITEM_STATUS_LABELS[action.status] || action.status}</span>
      </div>
      {(action.owner || action.dueDate || action.completedInRange) && <div className="report-action-meta">{action.owner && <span>负责人：{action.owner}</span>}{action.dueDate && <span>截止：{action.dueDate}</span>}{action.completedInRange && <span>本期完成</span>}</div>}
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

function WorkItemReport({ item, today }: { item: ReportWorkItem; today: string }) {
  const visibleItemLogs = item.itemLogs.filter((log) => !log.isSystemLog);
  const hiddenSystemCount = item.itemLogs.filter((log) => log.isSystemLog).length;
  const actionItems = [...item.actionItems].sort((a, b) => {
    const priority = (action: ReportActionItem) => isOverdueAction(action, today) ? 0 : isOpenAction(action) ? 1 : 2;
    return priority(a) - priority(b) || (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || a.title.localeCompare(b.title, "zh-CN");
  });
  const openActionCount = actionItems.filter(isOpenAction).length;
  const overdueActionCount = actionItems.filter((action) => isOverdueAction(action, today)).length;
  return (
    <article className="report-work-item">
      <div className="report-work-item-head">
        <div className="report-tree-row report-tree-row--item"><Link href={`/items/${item.id}`}><strong>{item.title}</strong></Link></div>
        <div className="report-work-item-state"><span className={`badge badge-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span><span>{PRIORITY_LABELS[item.priority] || item.priority}</span><span>{HEALTH_LABELS[item.health] || item.health}</span></div>
      </div>
      {(item.owner || item.dueDate) && <div className="report-item-meta">{item.owner && <span>负责人：{item.owner}</span>}{item.dueDate && <span>截止：{item.dueDate}</span>}</div>}
      {(item.currentSummary || item.nextAction) && <div className="report-item-brief">{item.currentSummary && <div><span>当前</span><p>{item.currentSummary}</p></div>}{item.nextAction && <div><span>下一步</span><p>{item.nextAction}</p></div>}</div>}
      {visibleItemLogs.length > 0 && <div className="report-log-list">{visibleItemLogs.map((log) => <Link key={log.id} href={`/logs/${log.id}`} className="report-log-row"><span>{log.workDate}</span><small>事项记录</small><p>{logText(log)}</p></Link>)}</div>}
      {hiddenSystemCount > 0 && <div className="report-system-note">已保留 {hiddenSystemCount} 条历史系统变化日志，正文不展开。</div>}
      {actionItems.length > 0 && <div className="report-action-list"><div className="report-subsection-heading"><span>行动项</span><small>未完成 {openActionCount} · 逾期 {overdueActionCount} · 已完成 {actionItems.length - openActionCount}</small></div>{actionItems.map((action) => <ActionItemReport key={action.id} action={action} today={today} />)}</div>}
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
  const today = getLocalDateString();
  const reportItems = report.projects.flatMap((project) => [
    ...project.projectItems,
    ...project.milestones.flatMap((milestone) => milestone.workItems),
  ]);
  const reportActions = reportItems.flatMap((item) => item.actionItems);
  const openActionCount = reportActions.filter(isOpenAction).length;
  const overdueActionCount = reportActions.filter((action) => isOverdueAction(action, today)).length;
  const selectedProjectName = projectId ? projects.find((project) => project.id === projectId)?.name || "当前项目" : "全部项目";

  return (
    <div className="page-shell auxiliary-page reports-page report-workbench-page">
      <header className="command-page-header reports-header">
        <div>
          <h1>汇报</h1>
          <p>围绕本期真实事实组织项目、事项、行动项和日志，快速形成可发送的管理输出。</p>
        </div>
        <div className="page-header-actions"><CopyButton text={markdown} label="复制 Markdown" successLabel="已复制" variant="primary" /></div>
      </header>

      <section className="card report-filter-panel">
        <div className="report-filter-heading">
          <div><h2>汇报范围</h2></div>
          <strong>{range.start} 至 {range.end}</strong>
        </div>
        <div className="report-filter-presets">
          <Link className={`btn ${preset === "today" ? "btn-primary" : "btn-secondary"}`} href={queryFor({ preset: "today", start: undefined, end: undefined })}>今天</Link>
          <Link className={`btn ${preset === "week" ? "btn-primary" : "btn-secondary"}`} href={queryFor({ preset: "week", start: undefined, end: undefined })}>本周</Link>
          <Link className={`btn ${preset === "month" ? "btn-primary" : "btn-secondary"}`} href={queryFor({ preset: "month", start: undefined, end: undefined })}>本月</Link>
        </div>
        <form className="report-filter-form" action="/reports">
          <input type="hidden" name="preset" value="custom" />
          <label><span>开始日期</span><input name="start" type="date" defaultValue={range.start} required /></label>
          <label><span>结束日期</span><input name="end" type="date" defaultValue={range.end} required /></label>
          <label><span>项目范围</span><select name="projectId" defaultValue={projectId || ""}><option value="">全部项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <button className="btn btn-secondary" type="submit">应用范围</button>
        </form>
      </section>

      <section className="card report-summary-panel">
        <div className="report-summary-heading"><div><h2>本期摘要</h2></div><small>只基于已记录事实</small></div>
        <div className="report-summary-grid">
          <div><span>汇报项目</span><strong>{report.summary.projects}</strong></div>
          <div><span>事项</span><strong>{report.summary.workItems}</strong></div>
          <div><span>行动项</span><strong>{report.summary.actionItems}</strong></div>
          <div><span>本期 WorkLog</span><strong>{report.summary.logs}</strong></div>
          <div className="is-warning"><span>未完成行动</span><strong>{openActionCount}</strong></div>
          <div className="is-danger"><span>逾期行动</span><strong>{overdueActionCount}</strong></div>
        </div>
        <div className="report-summary-foot">当前范围：{selectedProjectName} · {totalVisibleLogs} 条人工进展，系统变化日志保留在事实树中但默认降级。</div>
      </section>

      <section className="report-secondary-links report-secondary-links--header">
        <Link href={queryFor({ preset: "today", start: undefined, end: undefined })} className="btn btn-secondary"><Icon name="calendar" size={14} />查看今日</Link>
        <Link href={`/export/range?start=${range.start}&end=${range.end}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`} className="btn btn-secondary"><Icon name="download" size={14} />导出 Markdown</Link>
        <Link href="/projects" className="btn btn-secondary"><Icon name="folder" size={14} />查看项目</Link>
      </section>

      {report.projects.length === 0 ? (
        <section className="report-quiet-empty"><strong>本周期暂无新增进展</strong><p>当前范围内没有可汇报的项目事实、事项记录或行动项变化。</p></section>
      ) : (
        <div className="report-project-list">
          {report.projects.map((project) => {
            const projectItems = [...project.projectItems, ...project.milestones.flatMap((milestone) => milestone.workItems)];
            const projectActions = projectItems.flatMap((item) => item.actionItems);
            const projectLogs = project.projectLogs.length + projectItems.reduce((count, item) => count + item.itemLogs.length + item.actionItems.reduce((actionCount, action) => actionCount + action.logs.length, 0), 0);
            const projectOpenActions = projectActions.filter(isOpenAction).length;
            const projectOverdueActions = projectActions.filter((action) => isOverdueAction(action, today)).length;
            return (
              <section key={project.id} className="card report-project-tree">
                <div className="report-project-heading">
                  <div><span>项目</span><h2>{project.name}</h2></div>
                  <div className="report-project-state"><span>{PROJECT_STATUS_LABELS[project.status] || project.status}</span><span>{HEALTH_LABELS[project.health] || project.health}</span></div>
                </div>
                <div className="report-project-summary"><span>{projectLogs} 条事实</span><span>{projectItems.length} 个事项</span><span>未完成行动 {projectOpenActions}</span>{projectOverdueActions > 0 && <span className="is-danger">逾期行动 {projectOverdueActions}</span>}</div>
                {project.projectLogs.length > 0 && <div className="report-project-log-context"><div className="report-subsection-heading"><span>项目记录</span><small>本期事实</small></div>{project.projectLogs.filter((log) => !log.isSystemLog).map((log) => <Link key={log.id} href={`/logs/${log.id}`} className="report-log-row"><span>{log.workDate}</span><small>项目记录</small><p>{logText(log)}</p></Link>)}</div>}
                {project.milestones.map((milestone) => <div key={milestone.id} className="report-milestone-block"><div className="report-milestone-heading"><strong>{milestone.gateKey ? `${milestone.gateKey} · ` : "STR / "}{milestone.title}</strong><span>{PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}{milestone.targetDate ? ` · 目标 ${milestone.targetDate}` : ""}</span></div>{milestone.workItems.map((item) => <WorkItemReport key={item.id} item={item} today={today} />)}</div>)}
                {project.projectItems.length > 0 && <div className="report-milestone-block"><div className="report-milestone-heading"><strong>项目级事项</strong><span>未归属 STR · 不根据标题推断</span></div>{project.projectItems.map((item) => <WorkItemReport key={item.id} item={item} today={today} />)}</div>}
              </section>
            );
          })}
        </div>
      )}

      <details className="card report-draft-panel"><summary><strong>Markdown 输出</strong><span>复制或外部发送，默认收起</span></summary><div className="export-preview-bar report-draft-bar"><span>report-facts.md</span><span>辅助出口</span><CopyButton text={markdown} label="复制 Markdown" successLabel="已复制" variant="primary" /></div><pre>{markdown}</pre></details>
      <WbsReportFacts />
    </div>
  );
}
