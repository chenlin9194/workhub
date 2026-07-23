import Link from "next/link";
import Icon from "@/components/Icon";
import CopyButton from "@/components/CopyButton";
import { prisma } from "@/lib/prisma";
import { generateTodayMarkdown } from "@/lib/export";
import { getLocalDateString, getTodayRange } from "@/lib/utils";
import { excludeClosedItemsFromUpdatedItems } from "@/lib/todayBuckets";
import {
  getReportQualityItems,
  REPORT_QUALITY_LABELS,
  REPORT_QUALITY_VALUES,
  type ReportQuality,
  type ReportReadinessItem,
} from "@/lib/reportReadiness";
import WbsReportFacts from "@/components/WbsReportFacts";
import { getProjectDisplayName } from "@/lib/projectDisplay";

export const dynamic = "force-dynamic";

const secondaryLinks = [
  { href: "/export/today", label: "今日日报事实包", icon: "calendar" },
  { href: "/export/range", label: "区间 / 周报事实包", icon: "download" },
  { href: "/projects", label: "项目快照事实包", icon: "folder" },
  { href: "/stats", label: "统计概览", icon: "activity" },
] as const;

function isSystemLogTitle(title: string) {
  return title.startsWith("事项变化：") || title.startsWith("浜嬮」鍙樺寲");
}

function qualityActionHref(quality: ReportQuality, item: ReportReadinessItem) {
  if (quality === "p0p1_without_today_log") return `/logs/new?itemId=${encodeURIComponent(item.id)}`;
  if (quality === "blocked_without_risk_log") {
    return `/logs/new?itemId=${encodeURIComponent(item.id)}&type=blocker&reportable=true`;
  }
  return `/items/${item.id}/edit`;
}

function qualityActionLabel(quality: ReportQuality) {
  return quality === "missing_owner" || quality === "missing_next_action" || quality === "missing_project"
    ? "补充事项"
    : "记录进展";
}

export default async function ReportsPage() {
  const today = getLocalDateString();
  const { start: todayStart, end: todayEnd } = getTodayRange();

  const [
    workLogs,
    closedItems,
    rawUpdatedItems,
    openHighPriorityItems,
    dueTodayItems,
    overdueItems,
    riskAndBlockerLogs,
    decisionLogs,
    reportableLogs,
    activeItemsForChecks,
    riskProjects,
  ] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: today },
      include: {
        item: { select: { id: true, title: true } },
        projectRef: { select: { id: true, name: true } },
      },
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
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.workItem.findMany({
      where: { dueDate: today, status: { not: "closed" } },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.workItem.findMany({
      where: { dueDate: { lt: today }, status: { not: "closed" } },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
    }),
    prisma.workLog.findMany({
      where: { workDate: today, type: { in: ["risk", "blocker"] } },
      include: {
        item: { select: { id: true, title: true } },
        projectRef: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workLog.findMany({
      where: { workDate: today, type: "decision" },
      include: {
        item: { select: { id: true, title: true } },
        projectRef: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workLog.findMany({
      where: {
        workDate: today,
        OR: [
          { reportable: true },
          { type: { in: ["risk", "blocker", "decision", "issue"] } },
        ],
      },
      include: {
        item: { select: { id: true, title: true } },
        projectRef: { select: { id: true, name: true } },
      },
      orderBy: [{ reportable: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.workItem.findMany({
      where: {
        status: { not: "closed" },
        OR: [
          { priority: { in: ["P0", "P1"] } },
          { status: "blocked" },
          { health: "red" },
          { dueDate: { lte: today } },
        ],
      },
      include: {
        logs: {
          select: { workDate: true, type: true },
        },
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.project.findMany({
      where: {
        items: {
          some: {
            status: { not: "closed" },
            OR: [
              { priority: { in: ["P0", "P1"] } },
              { status: "blocked" },
              { health: { in: ["red", "yellow"] } },
              { dueDate: { lt: today } },
            ],
          },
        },
      },
      include: {
        items: {
          where: {
            status: { not: "closed" },
            OR: [
              { priority: { in: ["P0", "P1"] } },
              { status: "blocked" },
              { health: { in: ["red", "yellow"] } },
              { dueDate: { lt: today } },
            ],
          },
          orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
          take: 5,
        },
      },
      take: 6,
    }),
  ]);

  const updatedItems = excludeClosedItemsFromUpdatedItems(closedItems, rawUpdatedItems);

  const markdown = generateTodayMarkdown({
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

  const qualityItems = getReportQualityItems(activeItemsForChecks, today);
  const qualityChecks = REPORT_QUALITY_VALUES.map((quality) => ({
    quality,
    label: REPORT_QUALITY_LABELS[quality],
    items: qualityItems[quality],
    href: `/items?quality=${quality}`,
  }));
  const hasReadinessAlerts = qualityChecks.some((check) => check.items.length > 0);
  const reportableManualLogs = reportableLogs.filter((log) => !isSystemLogTitle(log.title));

  return (
    <div className="page-shell auxiliary-page reports-page report-workbench-page">
      <header className="command-page-header reports-header">
        <div>
          <span className="section-eyebrow">FACT PACKAGE HUB</span>
          <h1>汇报入口</h1>
          <p>先检查今天有哪些可汇报事实和事实缺口，再复制 Markdown 给外部工具整理表达。WorkHub 只输出事实包，不自动生成管理结论。</p>
        </div>
      </header>

      <section className="report-secondary-links report-secondary-links--header">
        {secondaryLinks.map((link) => (
          <Link key={link.href} href={link.href} className="btn btn-secondary">
            <Icon name={link.icon} size={14} />
            {link.label}
          </Link>
        ))}
      </section>

      <section className="report-workbench-grid">
        <div className="card report-facts-panel">
          <div className="dashboard-section-title">
            <div>
              <span className="section-eyebrow">TODAY FACTS</span>
              <h2>今日可汇报事实</h2>
            </div>
            <Link href="/logs?reportable=true" className="section-link">
              全部事实 <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          {reportableManualLogs.length === 0 ? (
            <div className="report-quiet-empty">今日暂无人工可汇报事实，建议先回到日志补齐关键事实。</div>
          ) : (
            <div className="report-fact-list">
              {reportableManualLogs.slice(0, 6).map((log) => (
                <Link key={log.id} href={`/logs/${log.id}`} className="report-fact-row">
                  <span className={`report-fact-type report-fact-type--${log.type}`}>{log.type}</span>
                  <strong>{log.title}</strong>
                  <small>{getProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project }) !== "未关联项目"
                    ? getProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project })
                    : log.item?.title || "未关联上下文"}</small>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card report-quality-panel">
          <div className="dashboard-section-title">
            <div>
              <span className="section-eyebrow">QUALITY CHECK</span>
              <h2>事实质量检查</h2>
            </div>
          </div>
          <div className="report-quality-list">
            {qualityChecks.map((check) => (
              <div key={check.quality} className={`report-quality-row is-${check.items.length ? "warning" : "neutral"}`}>
                <div className="report-quality-row-head">
                  <span>{check.label}</span>
                  <Link href={check.href} className="section-link">
                    查看全部（{check.items.length}） <Icon name="chevron-right" size={13} />
                  </Link>
                </div>
                {check.items.length > 0 && (
                  <div className="report-quality-item-list">
                    {check.items.slice(0, 3).map((item) => (
                      <Link key={item.id} href={qualityActionHref(check.quality, item)} className="report-quality-item-link">
                        <span>{item.title}</span>
                        <small>{qualityActionLabel(check.quality)} <Icon name="chevron-right" size={12} /></small>
                      </Link>
                    ))}
                    {check.items.length > 3 && (
                      <Link href={check.href} className="report-quality-more">还有 {check.items.length - 3} 项待补充</Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card report-draft-panel">
        <div className="export-preview-bar report-draft-bar">
          <span>daily-facts.md</span>
          <span>MARKDOWN</span>
          <CopyButton
            text={markdown}
            label={hasReadinessAlerts ? "复制今日事实包（需确认）" : "复制今日事实包"}
            successLabel="已复制，可粘贴到外部工具"
            variant="primary"
          />
        </div>
        <pre>{markdown}</pre>
      </section>

      <section className="card report-risk-panel">
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">PROJECT RISK</span>
            <h2>项目风险摘要</h2>
          </div>
        </div>
        {riskProjects.length === 0 ? (
          <div className="report-quiet-empty">当前没有需要在汇报入口突出展示的项目风险。</div>
        ) : (
          <div className="report-project-risk-list">
            {riskProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="report-project-risk-row">
                <strong>{project.name}</strong>
                <span>{project.items.length} 个未关闭风险信号</span>
                <small>{project.items.slice(0, 2).map((item) => item.title).join(" / ")}</small>
              </Link>
            ))}
          </div>
        )}
      </section>

      <WbsReportFacts />

      <div className="export-rule-note report-boundary-note">
        <strong>边界：</strong>
        <span>这里维护事实质量和事实包交付，不补写事实、不推断结论、不替代外部汇报表达。</span>
      </div>
    </div>
  );
}
