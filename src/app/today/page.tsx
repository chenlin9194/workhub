import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import { formatTodayStr, getLocalDateString, getTodayRange } from "@/lib/utils";
import { signalToItemsHref, signalToLogsHref } from "@/lib/signalMap";
import TodayActionQueue from "@/components/TodayActionQueue";
import TodayWbsQueue from "@/components/TodayWbsQueue";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = getLocalDateString();
  const { start: todayStart, end: todayEnd } = getTodayRange();

  const [
    todayLogs,
    todayClosedItems,
    todayUpdatedItems,
    p0p1Items,
    todayDueItems,
    overdueItems,
    riskBlockerLogs,
    decisionLogs,
    openActionItems,
  ] = await Promise.all([
    prisma.workLog.findMany({ where: { workDate: today }, orderBy: { createdAt: "desc" } }),
    prisma.workItem.findMany({ where: { closedAt: { gte: todayStart, lt: todayEnd } }, orderBy: { closedAt: "desc" } }),
    prisma.workItem.findMany({ where: { updatedAt: { gte: todayStart, lt: todayEnd } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.workItem.findMany({ where: { priority: { in: ["P0", "P1"] }, status: { not: "closed" } }, orderBy: { priority: "asc" } }),
    prisma.workItem.findMany({ where: { dueDate: today, status: { not: "closed" } }, orderBy: { priority: "asc" } }),
    prisma.workItem.findMany({ where: { dueDate: { lt: today }, status: { not: "closed" } }, orderBy: { dueDate: "asc" }, take: 20 }),
    prisma.workLog.findMany({ where: { workDate: today, type: { in: ["risk", "blocker"] } }, orderBy: { createdAt: "desc" } }),
    prisma.workLog.findMany({ where: { workDate: today, type: "decision" }, orderBy: { createdAt: "desc" } }),
    prisma.actionItem.findMany({
      where: { status: { not: "done" } },
      include: {
        workItem: { select: { id: true, title: true } },
        workLog: { select: { id: true, title: true } },
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { dueDate: "asc" },
        { status: "asc" },
        { createdAt: "asc" },
      ],
      take: 20,
    }),
  ]);

  const situation = [
    { label: "今日日志", value: todayLogs.length, icon: "file-text", tone: "blue" },
    { label: "待办行动项", value: openActionItems.length, icon: "clipboard-list", tone: "purple" },
    { label: "关闭事项", value: todayClosedItems.length, icon: "check-circle", tone: "success" },
    { label: "更新事项", value: todayUpdatedItems.length, icon: "refresh", tone: "cyan" },
    { label: "P0/P1", value: p0p1Items.length, icon: "zap", tone: "warning" },
    { label: "逾期", value: overdueItems.length, icon: "clock", tone: "danger" },
  ];

  const sections = [
    { title: "P0/P1 未关闭事项", subtitle: "HIGH PRIORITY", items: p0p1Items, type: "item", count: p0p1Items.length, tone: "warning", icon: "zap", emptyText: "当前无高优未关闭事项，优先级压力可控。" },
    { title: "今日到期事项", subtitle: "DUE TODAY", items: todayDueItems, type: "item", count: todayDueItems.length, tone: "purple", icon: "calendar", emptyText: "今日无到期事项，交付窗口暂时稳定。" },
    { title: "逾期未关闭事项", subtitle: "OVERDUE", items: overdueItems, type: "item", count: overdueItems.length, tone: "danger", icon: "clock", href: signalToItemsHref("overdue"), emptyText: "今日无逾期事项，交付节奏正常。" },
    { title: "今日新增日志", subtitle: "TODAY SIGNALS", items: todayLogs, type: "log", count: todayLogs.length, tone: "blue", icon: "file-text", href: signalToLogsHref("todayLogs", undefined, today), emptyText: "今天还没有新增日志，可先记录关键事实。" },
    { title: "今日更新事项", subtitle: "IN MOTION", items: todayUpdatedItems, type: "item", count: todayUpdatedItems.length, tone: "cyan", icon: "refresh", emptyText: "今日暂无事项更新，当前变更压力较低。" },
    { title: "今日关闭事项", subtitle: "DELIVERED", items: todayClosedItems, type: "item", count: todayClosedItems.length, tone: "success", icon: "check-circle", emptyText: "今日暂无关闭事项，后续闭环后会在这里呈现。" },
    { title: "今日风险/阻塞日志", subtitle: "RISK SIGNALS", items: riskBlockerLogs, type: "log", count: riskBlockerLogs.length, tone: "danger", icon: "alert-triangle", emptyText: "今日无风险/阻塞日志，风险记录暂时稳定。" },
    { title: "今日决策日志", subtitle: "DECISIONS", items: decisionLogs, type: "log", count: decisionLogs.length, tone: "success", icon: "lightbulb", href: signalToLogsHref("decision", undefined, today), emptyText: "今日无决策日志，关键结论可在形成后补记。" },
  ];

  const todayGroups = [
    { title: "需要处理", eyebrow: "ACTION", hint: "优先扫 P0/P1、今日到期与逾期。", sections: sections.slice(0, 3) },
    { title: "今日事实", eyebrow: "FACTS", hint: "今天新增和变动的事实记录。", sections: sections.slice(3, 5) },
    { title: "今日闭环", eyebrow: "DELIVERY", hint: "已经关闭的事项会支撑日报表达。", sections: sections.slice(5, 6) },
    { title: "风险决策", eyebrow: "RISK & DECISION", hint: "用于汇报保留的风险、阻塞和决策依据。", sections: sections.slice(6) },
  ];

  return (
    <div className="page-shell auxiliary-page today-page today-cockpit-page">
      <header className="command-page-header">
        <div>
          <span className="section-eyebrow">DAILY DELIVERY PULSE</span>
          <h1>今日工作视图</h1>
          <p>{formatTodayStr()}</p>
        </div>
        <div className="page-header-actions">
          <Link href="/export/today" className="btn btn-secondary"><Icon name="download" size={15} />导出今日</Link>
        </div>
      </header>

      <section className="card cockpit-card today-situation today-cockpit-situation" aria-label="今日态势">
        <div className="cockpit-card-head">
          <div>
            <span className="section-eyebrow">TODAY STATUS</span>
            <h2>今日态势</h2>
          </div>
          <span className="section-live"><i />实时</span>
        </div>
        <div className="today-situation-grid cockpit-metrics">
          {situation.map((item) => (
            <div key={item.label} className={`stat-card today-metric metric-${item.tone}`}>
              <div className="stat-topline">
                <span className="stat-icon"><Icon name={item.icon} size={15} /></span>
                <span className="stat-meta">TODAY</span>
              </div>
              <strong className="stat-value">{item.value}</strong>
              <span className="stat-label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <TodayActionQueue initialItems={openActionItems} today={today} />
      <TodayWbsQueue today={today} />

      <div className="today-sections">
        {todayGroups.map((group) => (
          <section key={group.title} className="card cockpit-card today-group-card">
            <div className="cockpit-card-head">
              <div>
                <span className="section-eyebrow">{group.eyebrow}</span>
                <h2>{group.title}</h2>
              </div>
              <span className="section-count">{group.hint}</span>
            </div>
            <div className="today-group-sections">
              {group.sections.map((section) => (
                <section key={section.title} className={`today-section section-tone-${section.tone}`}>
                  <div className="today-section-header">
                    <span className="today-section-icon"><Icon name={section.icon} size={16} /></span>
                    <div><strong>{section.title}</strong><small>{section.subtitle}</small></div>
                    {section.href ? (
                      <Link href={section.href} className="section-link">
                        查看全部 <Icon name="chevron-right" size={14} />
                      </Link>
                    ) : (
                      <span className="section-count">{section.count} 条</span>
                    )}
                  </div>
                  {section.items.length === 0 ? (
                    <div className="today-compact-empty"><span />{section.emptyText}</div>
                  ) : (
                    <div className="today-section-content">
                      {section.type === "log" ? (
                        <div className="content-card-grid">
                          {(section.items as { id: string; workDate: string; title: string; content: string; type: string; source: string; project?: string | null; module?: string | null; itemId?: string | null; createdAt: Date; updatedAt: Date }[]).map((log) => <WorkLogCard key={log.id} log={log} />)}
                        </div>
                      ) : (
                        <div className="content-card-grid">
                          {(section.items as { id: string; title: string; description?: string | null; project?: string | null; module?: string | null; type: string; priority: string; status: string; owner?: string | null; dueDate?: string | null; nextAction?: string | null; createdAt: Date; updatedAt: Date; closedAt?: Date | null }[]).map((item) => <WorkItemCard key={item.id} item={item} />)}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
