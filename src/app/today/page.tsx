import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import { formatTodayStr, getTodayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = getTodayStr();
  const todayStart = new Date(today);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    todayLogs,
    todayClosedItems,
    todayUpdatedItems,
    p0p1Items,
    todayDueItems,
    overdueItems,
    riskBlockerLogs,
    decisionLogs,
  ] = await Promise.all([
    prisma.workLog.findMany({ where: { workDate: today }, orderBy: { createdAt: "desc" } }),
    prisma.workItem.findMany({ where: { closedAt: { gte: todayStart, lt: todayEnd } }, orderBy: { closedAt: "desc" } }),
    prisma.workItem.findMany({ where: { updatedAt: { gte: todayStart, lt: todayEnd } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.workItem.findMany({ where: { priority: { in: ["P0", "P1"] }, status: { not: "closed" } }, orderBy: { priority: "asc" } }),
    prisma.workItem.findMany({ where: { dueDate: today, status: { not: "closed" } }, orderBy: { priority: "asc" } }),
    prisma.workItem.findMany({ where: { dueDate: { lt: today }, status: { not: "closed" } }, orderBy: { dueDate: "asc" }, take: 20 }),
    prisma.workLog.findMany({ where: { workDate: today, type: { in: ["risk", "blocker"] } }, orderBy: { createdAt: "desc" } }),
    prisma.workLog.findMany({ where: { workDate: today, type: "decision" }, orderBy: { createdAt: "desc" } }),
  ]);

  const situation = [
    { label: "今日日志", value: todayLogs.length, icon: "file-text", tone: "blue" },
    { label: "关闭事项", value: todayClosedItems.length, icon: "check-circle", tone: "success" },
    { label: "更新事项", value: todayUpdatedItems.length, icon: "refresh", tone: "cyan" },
    { label: "P0/P1", value: p0p1Items.length, icon: "zap", tone: "warning" },
    { label: "逾期", value: overdueItems.length, icon: "clock", tone: "danger" },
  ];

  const sections = [
    { title: "今日新增日志", subtitle: "TODAY SIGNALS", items: todayLogs, type: "log", count: todayLogs.length, tone: "blue", icon: "file-text" },
    { title: "今日关闭事项", subtitle: "DELIVERED", items: todayClosedItems, type: "item", count: todayClosedItems.length, tone: "success", icon: "check-circle" },
    { title: "今日更新事项", subtitle: "IN MOTION", items: todayUpdatedItems, type: "item", count: todayUpdatedItems.length, tone: "cyan", icon: "refresh" },
    { title: "P0/P1 未关闭事项", subtitle: "HIGH PRIORITY", items: p0p1Items, type: "item", count: p0p1Items.length, tone: "warning", icon: "zap" },
    { title: "今日到期事项", subtitle: "DUE TODAY", items: todayDueItems, type: "item", count: todayDueItems.length, tone: "purple", icon: "calendar" },
    { title: "逾期未关闭事项", subtitle: "OVERDUE", items: overdueItems, type: "item", count: overdueItems.length, tone: "danger", icon: "clock" },
    { title: "今日风险/阻塞日志", subtitle: "RISK SIGNALS", items: riskBlockerLogs, type: "log", count: riskBlockerLogs.length, tone: "danger", icon: "alert-triangle" },
    { title: "今日决策日志", subtitle: "DECISIONS", items: decisionLogs, type: "log", count: decisionLogs.length, tone: "success", icon: "lightbulb" },
  ];

  return (
    <div className="today-page">
      <header className="command-page-header">
        <div>
          <span className="section-eyebrow">DAILY DELIVERY PULSE</span>
          <h1>今日工作视图</h1>
          <p>{formatTodayStr()}</p>
        </div>
        <Link href="/export/today" className="btn btn-secondary"><Icon name="download" size={15} />导出今日</Link>
      </header>

      <section className="today-situation card" aria-label="今日态势">
        <div className="today-situation-label">
          <span className="hero-status-dot" />
          <div><strong>今日态势</strong><small>TODAY STATUS</small></div>
        </div>
        <div className="today-situation-grid">
          {situation.map((item) => (
            <div key={item.label} className={`today-metric metric-${item.tone}`}>
              <span><Icon name={item.icon} size={15} /></span>
              <div><strong>{item.value}</strong><small>{item.label}</small></div>
            </div>
          ))}
        </div>
      </section>

      <div className="today-sections">
        {sections.map((section) => (
          <section key={section.title} className={`card today-section section-tone-${section.tone}`}>
            <div className="today-section-header">
              <span className="today-section-icon"><Icon name={section.icon} size={16} /></span>
              <div><strong>{section.title}</strong><small>{section.subtitle}</small></div>
              <span className="section-count">{section.count} 条</span>
            </div>
            {section.items.length === 0 ? (
              <div className="today-compact-empty"><span />当前无相关数据</div>
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
    </div>
  );
}
