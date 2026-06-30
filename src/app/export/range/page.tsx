import { prisma } from "@/lib/prisma";
import { generateRangeMarkdown } from "@/lib/export";
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
          <div><span className="section-eyebrow">FACT PACKAGE / RANGE</span><h1>区间 / 周报事实包</h1></div>
        </div>
        <div className="card export-notice">
          <div className="export-notice-icon">i</div>
          <div><strong>请提供导出日期范围</strong><p>请选择 start 和 end 日期，生成对应时间范围的 Markdown 事实包。日期格式为 YYYY-MM-DD。</p></div>
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

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);

  const [workLogs, closedItems, updatedItems] = await Promise.all([
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

  const md = generateRangeMarkdown({ start, end, workLogs, closedItems, updatedItems });

  return (
    <div className="export-page">
      <div className="export-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE / RANGE</span>
          <h1>区间 / 周报事实包</h1>
          <p>{start} 至 {end}</p>
        </div>
        <CopyButton text={md} />
      </div>

      <div className="card export-notice">
        <div className="export-notice-icon">i</div>
        <div><strong>Work Hub 只导出事实包，不调用 AI</strong><p>按时间范围汇总工作日志、关闭事项和更新事项，复制 Markdown 后可交给外部 AI 整理成周报或阶段汇报。Work Hub 只导出事实包，不调用 AI、不生成管理结论。外部 AI 只能基于 Markdown 整理表达，不得补写事实；缺失信息请标记为“待确认”。</p></div>
        <span className="export-ready-tag"><i />Ready for Claude Code / Codex</span>
      </div>

      <div className="card export-preview">
        <div className="export-preview-bar"><span><i className="preview-dot red" /><i className="preview-dot amber" /><i className="preview-dot green" /></span><span>range-facts.md</span><span>MARKDOWN</span></div>
        <pre>{md}</pre>
      </div>
    </div>
  );
}
