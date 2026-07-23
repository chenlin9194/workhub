import { prisma } from "@/lib/prisma";
import { generateRangeMarkdown } from "@/lib/export";
import { excludeClosedItemsFromUpdatedItems } from "@/lib/todayBuckets";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function ExportRangePage({ searchParams }: PageProps) {
  const { start, end } = await searchParams;

  if (!start || !end) {
    return (
      <div className="page-shell auxiliary-page export-page">
        <div className="export-header command-page-header">
          <div><span className="section-eyebrow">FACT PACKAGE / RANGE</span><h1>区间 / 周报事实包</h1></div>
        </div>
        <div className="card export-notice">
          <div className="export-notice-icon">i</div>
          <div><strong>请提供导出日期范围</strong><p>请选择 start 和 end 日期，生成对应时间范围的 Markdown 事实包。日期格式为 YYYY-MM-DD。</p></div>
        </div>
        <form action="/export/range" className="card form-card export-range-query-form">
          <div className="field-grid-2">
            <label>
              <span className="form-field-label">开始日期</span>
              <input className="form-field-control" name="start" type="date" required />
            </label>
            <label>
              <span className="form-field-label">结束日期</span>
              <input className="form-field-control" name="end" type="date" required />
            </label>
          </div>
          <div className="export-range-actions">
            <button type="submit" className="btn btn-primary">生成区间事实包</button>
            <span>提交后将跳转到带 start / end 参数的区间事实包页面。</span>
          </div>
        </form>
        <div className="card export-preview export-range-help">
          <div className="export-preview-bar"><span><i className="preview-dot red" /><i className="preview-dot amber" /><i className="preview-dot green" /></span><span>range-query.txt</span><span>EXAMPLE</span></div>
          <code>/export/range?start=2025-01-01&end=2025-01-07</code>
        </div>
      </div>
    );
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);

  const [workLogs, closedItems, rawUpdatedItems] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: { gte: start, lte: end } },
      include: {
        item: { select: { id: true, title: true } },
        projectRef: { select: { id: true, name: true } },
      },
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

  const updatedItems = excludeClosedItemsFromUpdatedItems(closedItems, rawUpdatedItems);

  const md = generateRangeMarkdown({ start, end, workLogs, closedItems, updatedItems });

  return (
    <div className="page-shell auxiliary-page export-page">
      <div className="export-header command-page-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE / RANGE</span>
          <h1>区间 / 周报事实包</h1>
          <p>{start} 至 {end}</p>
        </div>
        <div className="page-header-actions">
          <CopyButton text={md} label="复制区间 / 周报事实包" />
        </div>
      </div>

      <div className="card export-notice">
        <div className="export-notice-icon">i</div>
        <div style={{ minWidth: 0 }}>
          <strong>Work Hub 只导出事实包</strong>
          <p>按时间范围汇总工作日志、关闭事项和更新事项，复制 Markdown 后可交给外部工具整理成周报或阶段汇报。这里新增了质量检查和待确认信息，方便你先判断这份事实包是否够完整。</p>
          <div style={{ display: "grid", gap: 4, marginTop: 8, color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6 }}>
            <div>质量检查：帮助确认周报事实是否够完整、是否覆盖关键变化。</div>
            <div>待确认信息：提示缺责任人、下一步、项目/模块等需要补齐的内容。</div>
            <div>追溯编号：关键事实会保留 LOG-01、P-01 之类编号，便于回查具体日志和事项。</div>
            <div>外部工具只能整理表达，不得补写事实或扩大事实边界。</div>
          </div>
        </div>
        <span className="export-ready-tag"><i />可复制事实材料</span>
      </div>

      <div className="card export-preview">
        <div className="export-preview-bar"><span><i className="preview-dot red" /><i className="preview-dot amber" /><i className="preview-dot green" /></span><span>range-facts.md</span><span>MARKDOWN</span></div>
        <pre>{md}</pre>
      </div>
    </div>
  );
}
