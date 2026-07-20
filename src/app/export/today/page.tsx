import { prisma } from "@/lib/prisma";
import { getLocalDateString, formatTodayStr, getTodayRange } from "@/lib/utils";
import { generateTodayMarkdown } from "@/lib/export";
import CopyButton from "@/components/CopyButton";
import Icon from "@/components/Icon";

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

  const trackedItemMap = new Map(
    [...closedItems, ...updatedItems, ...openHighPriorityItems, ...dueTodayItems, ...overdueItems].map((item) => [item.id, item])
  );
  const trackedItems = Array.from(trackedItemMap.values());
  const factsCount = workLogs.length + trackedItems.length;
  const riskSignalCount = riskAndBlockerLogs.length + overdueItems.length + openHighPriorityItems.length;
  const missingOwnerCount = trackedItems.filter((item) => !item.owner?.trim()).length;
  const missingNextActionCount = trackedItems.filter((item) => !item.nextAction?.trim()).length;
  const logsWithTraceCount = workLogs.filter((log) => log.item || log.sourceUrl || log.project || log.module).length;
  const traceRate = workLogs.length > 0 ? Math.round((logsWithTraceCount / workLogs.length) * 100) : 100;
  const highPriorityWithoutTodayLog = openHighPriorityItems.filter(
    (item) => !workLogs.some((log) => log.item?.id === item.id || log.item?.title === item.title)
  );
  const pendingCheckCount = missingOwnerCount + missingNextActionCount + highPriorityWithoutTodayLog.length;
  const copyState = pendingCheckCount > 0 ? "可复制，需确认" : "可复制";

  const exportChecks = [
    { label: "事实规模", value: factsCount, note: `日志 ${workLogs.length} / 事项 ${trackedItems.length}`, icon: "file-text", tone: "neutral" },
    { label: "风险信号", value: riskSignalCount, note: riskSignalCount > 0 ? "复制前先确认表达" : "今日压力较低", icon: "alert-triangle", tone: riskSignalCount > 0 ? "warning" : "neutral" },
    { label: "待确认", value: pendingCheckCount, note: `责任人 ${missingOwnerCount} / 下一步 ${missingNextActionCount} / P0-P1 无当日日志 ${highPriorityWithoutTodayLog.length}`, icon: "flag", tone: pendingCheckCount > 0 ? "warning" : "success" },
    { label: "证据完整", value: `${traceRate}%`, note: "日志关联覆盖", icon: "target", tone: "neutral" },
  ];

  return (
    <div className="page-shell auxiliary-page export-page export-today-package-page">
      <div className="export-header command-page-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE / TODAY</span>
          <h1>今日日报事实包</h1>
          <p>{formatTodayStr()}</p>
          <div className={`daily-package-status ${pendingCheckCount > 0 ? "is-warning" : "is-ready"}`}>
            <strong>今日事实包 · {copyState}</strong>
            <span>
              事实 {factsCount} 条 · 风险 {riskSignalCount} 项 · 待确认 {pendingCheckCount} · 证据完整度 {traceRate}%
            </span>
          </div>
        </div>
        <div className="page-header-actions">
          <CopyButton
            text={md}
            label="复制今日日报事实包"
            successLabel="已复制，可粘贴到外部工具"
            variant="primary"
          />
        </div>
      </div>

      <section className="card export-quality-strip">
        <div className="export-quality-head">
          <div>
            <span className="section-eyebrow">PRE-COPY QA</span>
            <h2>复制前质检</h2>
          </div>
          <span>先判断事实够不够，再复制。</span>
        </div>
        <div className="export-quality-grid">
          {exportChecks.map((check) => (
            <div key={check.label} className={`export-quality-item metric-${check.tone}`}>
              <span className="export-check-icon">
                <Icon name={check.icon} size={15} />
              </span>
              <div>
                <strong>{check.value}</strong>
                <span>{check.label}</span>
                <small>{check.note}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="export-rule-note">
        <strong>规则：</strong>
        <span>这里只复制事实，不生成结论。复制后请先核对事实，再交给外部工具整理表达；不补写、不推断、不扩大事实边界。</span>
      </div>

      <section className="card export-preview export-preview--secondary export-deliverable-card">
        <div className="export-preview-bar">
          <span>
            <i className="preview-dot red" />
            <i className="preview-dot amber" />
            <i className="preview-dot green" />
          </span>
          <span>daily-facts.md</span>
          <span>MARKDOWN</span>
          <div className="export-preview-copy">
            <CopyButton
              text={md}
              label="复制今日日报事实包"
              successLabel="已复制，可粘贴到外部工具"
              variant="primary"
            />
          </div>
        </div>
        <pre>{md}</pre>
      </section>
    </div>
  );
}
