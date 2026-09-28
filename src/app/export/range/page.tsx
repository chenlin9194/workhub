import CopyButton from "@/components/CopyButton";
import { aggregateReport } from "@/lib/reportAggregator";
import { generateReportMarkdown } from "@/lib/export";
import { isValidYmdDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ExportRangeProps { searchParams: Promise<{ start?: string; end?: string; projectId?: string }> }

export default async function ExportRangePage({ searchParams }: ExportRangeProps) {
  const params = await searchParams;
  if (!isValidYmdDateString(params.start) || !isValidYmdDateString(params.end) || params.start > params.end) {
    return <div className="page-shell auxiliary-page export-page"><div className="export-header command-page-header"><div><h1>区间 / 周报事实包</h1></div></div><div className="card export-notice"><strong>请提供有效的导出日期范围</strong><p>请选择开始和结束日期，格式为 YYYY-MM-DD。</p></div><form action="/export/range" className="card form-card export-range-query-form"><div className="field-grid-2"><label><span className="form-field-label">开始日期</span><input className="form-field-control" name="start" type="date" required /></label><label><span className="form-field-label">结束日期</span><input className="form-field-control" name="end" type="date" required /></label></div><button type="submit" className="btn btn-primary">生成区间事实包</button></form></div>;
  }
  const report = await aggregateReport({ startDate: params.start, endDate: params.end, projectId: params.projectId });
  const markdown = generateReportMarkdown(report);
  return <div className="page-shell auxiliary-page export-page"><div className="export-header command-page-header"><div><h1>区间 / 周报事实包</h1><p>{params.start} 至 {params.end}</p></div></div><div className="export-rule-note"><strong>规则：</strong><span>页面和 Markdown 使用同一份项目 → STR/里程碑 → 事项 → 行动项 → 日志聚合结果，不依赖 updatedAt 或 reportable 状态桶。</span></div><section className="card export-preview"><div className="export-preview-bar"><span>区间事实包.md</span><span>Markdown 格式</span><CopyButton text={markdown} label="复制事实包" successLabel="已复制" variant="primary" /></div><pre>{markdown}</pre></section></div>;
}
