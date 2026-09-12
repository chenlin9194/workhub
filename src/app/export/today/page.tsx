import CopyButton from "@/components/CopyButton";
import { aggregateReport } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";
import { formatTodayStr, getLocalDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ExportTodayProps { searchParams: Promise<{ projectId?: string }> }

export default async function ExportTodayPage({ searchParams }: ExportTodayProps) {
  const { projectId } = await searchParams;
  const today = getLocalDateString();
  const report = await aggregateReport({ startDate: today, endDate: today, projectId });
  const markdown = generateReportMarkdown(report);
  return (
    <div className="page-shell auxiliary-page export-page export-today-package-page">
      <div className="export-header command-page-header"><div><span className="section-eyebrow">FACT PACKAGE / TODAY</span><h1>今日日报事实包</h1><p>{formatTodayStr()}</p><div className="daily-package-status is-ready"><strong>按层级聚合 · 可复制</strong><span>项目 {report.summary.projects} · 事项 {report.summary.workItems} · 行动项 {report.summary.actionItems} · 日志 {report.summary.logs}</span></div></div><div className="page-header-actions"><CopyButton text={markdown} label="复制今日日报事实包" successLabel="已复制" variant="primary" /></div></div>
      <div className="export-rule-note"><strong>规则：</strong><span>事实按项目、STR/里程碑、事项和行动项组织；历史系统变化日志保留在数据库但不作为正文主体；不使用 reportable 推断事实。</span></div>
      <section className="card export-preview export-deliverable-card"><div className="export-preview-bar"><span>daily-facts.md</span><span>MARKDOWN</span><CopyButton text={markdown} label="复制事实包" successLabel="已复制" variant="primary" /></div><pre>{markdown}</pre></section>
    </div>
  );
}
