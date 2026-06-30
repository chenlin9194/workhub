import { prisma } from "@/lib/prisma";
import { getLocalDateString, formatTodayStr, getTodayRange } from "@/lib/utils";
import { generateTodayMarkdown } from "@/lib/export";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function ExportTodayPage() {
  const today = getLocalDateString();
  const { start: todayStart, end: todayEnd } = getTodayRange();

  const [
    workLogs,
    closedItems,
    updatedItems,
    openHighPriorityItems,
    dueTodayItems,
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

  const md = generateTodayMarkdown({
    today,
    workLogs,
    closedItems,
    updatedItems,
    openHighPriorityItems,
    dueTodayItems,
    overdueItems,
    riskAndBlockerLogs,
    decisionLogs,
  });

  return (
    <div className="export-page">
      <div className="export-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE / TODAY</span>
          <h1>今日日报事实包</h1>
          <p>{formatTodayStr()}</p>
        </div>
        <CopyButton text={md} />
      </div>

      <div className="card export-notice">
        <div className="export-notice-icon">i</div>
        <div>
          <strong>Work Hub 只导出事实包，不调用 AI</strong>
          <p>汇总今天的日志、事项、风险与决策事实，复制 Markdown 后可交给外部 AI 整理成日报表达。Work Hub 只导出事实包，不调用 AI、不生成管理结论。外部 AI 只能基于 Markdown 整理表达，不得补写事实；缺失信息请标记为“待确认”。</p>
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
