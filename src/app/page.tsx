import Link from "next/link";
import Icon from "@/components/Icon";
import HomeTopbarActions from "@/components/HomeTopbarActions";
import SidebarNavigation from "@/components/SidebarNavigation";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import AttnRow from "@/components/redesign/AttnRow";
import KpiRow, { type KpiStat } from "@/components/redesign/KpiRow";
import Panel from "@/components/redesign/Panel";
import { prisma } from "@/lib/prisma";
import { formatTodayStr, getLocalDateString, getTodayRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FocusKey = "open" | "following" | "blocked" | "overdue" | "p0" | "p1" | "todayLogs" | "todayClosed";

interface PageProps {
  searchParams: Promise<{ focus?: string }>;
}

const focusLabels: Record<FocusKey, string> = {
  open: "待处理事项",
  following: "跟进中事项",
  blocked: "已阻塞事项",
  overdue: "逾期事项",
  p0: "P0 紧急事项",
  p1: "P1 高优事项",
  todayLogs: "今日事实",
  todayClosed: "今日关闭事项",
};

function normalizeFocusKey(value?: string): FocusKey | null {
  const key = value?.trim().toLowerCase();
  if (["open", "following", "blocked", "overdue", "p0", "p1"].includes(key || "")) return key as FocusKey;
  if (key === "todaylogs") return "todayLogs";
  if (key === "todayclosed") return "todayClosed";
  return null;
}

function itemCode(item: { id: string; sourceId?: string | null }) {
  return item.sourceId || `WI-${item.id.slice(-6).toUpperCase()}`;
}

function itemSubtitle(item: {
  currentSummary?: string | null;
  description?: string | null;
  project?: string | null;
  status: string;
}) {
  return item.currentSummary || item.description || item.project || `状态：${item.status}`;
}

async function loadFocusView(focus: FocusKey, today: string, todayStart: Date, todayEnd: Date) {
  if (focus === "todayLogs") {
    return {
      kind: "logs" as const,
      logs: await prisma.workLog.findMany({
        where: { workDate: today },
        include: { item: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    };
  }

  const where =
    focus === "following" ? { status: "following" } :
    focus === "blocked" ? { status: "blocked" } :
    focus === "overdue" ? { dueDate: { lt: today }, status: { not: "closed" } } :
    focus === "p0" ? { priority: "P0", status: { not: "closed" } } :
    focus === "p1" ? { priority: "P1", status: { not: "closed" } } :
    focus === "todayClosed" ? { closedAt: { gte: todayStart, lt: todayEnd } } :
    { status: "open" };

  return {
    kind: "items" as const,
    items: await prisma.workItem.findMany({ where, orderBy: { updatedAt: "desc" }, take: 12 }),
  };
}

export default async function Dashboard({ searchParams }: PageProps) {
  const focus = normalizeFocusKey((await searchParams).focus);
  const today = getLocalDateString();
  const dueSoonDate = new Date();
  dueSoonDate.setDate(dueSoonDate.getDate() + 3);
  const dueSoonEnd = getLocalDateString(dueSoonDate);
  const { start: todayStart, end: todayEnd } = getTodayRange();

  const [
    openCount,
    followingCount,
    blockedCount,
    p0Count,
    p1Count,
    todayFactsCount,
    todayClosedCount,
    blockedItems,
    p0Items,
    overdueItems,
    p1Items,
    upcomingItems,
    openActionItems,
  ] = await Promise.all([
    prisma.workItem.count({ where: { status: "open" } }),
    prisma.workItem.count({ where: { status: "following" } }),
    prisma.workItem.count({ where: { status: "blocked" } }),
    prisma.workItem.count({ where: { priority: "P0", status: { not: "closed" } } }),
    prisma.workItem.count({ where: { priority: "P1", status: { not: "closed" } } }),
    prisma.workLog.count({ where: { workDate: today } }),
    prisma.workItem.count({ where: { closedAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.workItem.findMany({ where: { status: "blocked" }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.workItem.findMany({ where: { priority: "P0", status: { not: "closed" } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.workItem.findMany({ where: { dueDate: { lt: today }, status: { not: "closed" } }, orderBy: { dueDate: "asc" }, take: 6 }),
    prisma.workItem.findMany({ where: { priority: "P1", status: { not: "closed" } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.workItem.findMany({ where: { dueDate: { gt: today, lte: dueSoonEnd }, status: { not: "closed" } }, orderBy: { dueDate: "asc" }, take: 6 }),
    prisma.actionItem.findMany({
      where: { status: { not: "done" } },
      include: {
        workItem: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 20,
    }),
  ]);

  const focusView = focus ? await loadFocusView(focus, today, todayStart, todayEnd) : null;

  const seenItems = new Set<string>();
  const primaryAttentionItems = [
    ...blockedItems.map((item) => ({ item, reason: "阻塞", tone: "critical" as const })),
    ...p0Items.map((item) => ({ item, reason: "P0", tone: "critical" as const })),
    ...overdueItems.map((item) => ({ item, reason: "逾期", tone: "critical" as const })),
  ].filter(({ item }) => {
    if (seenItems.has(item.id)) return false;
    seenItems.add(item.id);
    return true;
  });
  const secondaryAttentionItems = [
    ...p1Items.map((item) => ({ item, reason: "P1", tone: "warning" as const })),
    ...upcomingItems.map((item) => ({ item, reason: "临期", tone: "warning" as const })),
  ].filter(({ item }) => {
    if (seenItems.has(item.id)) return false;
    seenItems.add(item.id);
    return true;
  });
  const attentionRows = [
    ...primaryAttentionItems.map(({ item, reason, tone }) => ({
      href: `/items/${item.id}`,
      reason,
      tone,
      code: itemCode(item),
      title: item.title,
      subtitle: itemSubtitle(item),
      owner: item.owner,
      due: item.dueDate,
    })),
    ...secondaryAttentionItems.map(({ item, reason, tone }) => ({
      href: `/items/${item.id}`,
      reason,
      tone,
      code: itemCode(item),
      title: item.title,
      subtitle: itemSubtitle(item),
      owner: item.owner,
      due: item.dueDate,
    })),
  ].slice(0, 6);
  const actionRows = openActionItems.slice(0, 6).map((action) => ({
    href: action.workItemId ? `/items/${action.workItemId}` : "/today",
    reason: action.dueDate && action.dueDate < today ? "逾期" : action.status === "in_progress" ? "跟进中" : "待办",
    tone: action.dueDate && action.dueDate < today ? "critical" as const : action.status === "in_progress" ? "warning" as const : "neutral" as const,
    code: "ACTION",
    title: action.title,
    subtitle: action.workItem?.title ? `关联事项 · ${action.workItem.title}` : action.project?.name ? `关联项目 · ${action.project.name}` : "未关联事项的行动项",
    owner: action.owner,
    due: action.dueDate,
  }));

  const stats: KpiStat[] = [
    { label: "BLOCKED", value: blockedCount, name: "阻塞", meta: "需要处理", href: "/?focus=blocked", tone: "critical" },
    { label: "P0", value: p0Count, name: "紧急", meta: "高优事项", href: "/?focus=p0", tone: "critical" },
    { label: "P1", value: p1Count, name: "高优", meta: "需要关注", href: "/?focus=p1", tone: "warning" },
    { label: "OVERDUE", value: overdueItems.length, name: "逾期", meta: "待确认", href: "/?focus=overdue", tone: "critical" },
    { label: "OPEN", value: openCount, name: "待处理", meta: "事项队列", href: "/?focus=open", tone: "accent" },
    { label: "FOLLOW", value: followingCount, name: "跟进中", meta: "持续追踪", href: "/?focus=following", tone: "accent" },
    { label: "FACTS", value: todayFactsCount, name: "今日事实", meta: "已发生", href: "/?focus=todayLogs", tone: "positive" },
    { label: "CLOSED", value: todayClosedCount, name: "今日关闭", meta: "已完成", href: "/?focus=todayClosed", tone: "positive" },
  ];

  return (
    <div className="dashboard-shell redesign-dashboard-shell">
      <SidebarNavigation />
      <div className="cockpit-content redesign-cockpit-content">
        <header className="cockpit-topbar redesign-topbar">
          <div>
            <span className="cockpit-path">WORK / COCKPIT</span>
            <strong>{formatTodayStr()}</strong>
          </div>
          <form action="/items" className="cockpit-search">
            <Icon name="search" size={14} />
            <input type="hidden" name="visibility" value="open" />
            <input name="keyword" placeholder="搜索一切" />
          </form>
          <div className="redesign-topbar-actions">
            <Link href="/logs/new" className="btn btn-secondary btn-sm">＋ 记录事实</Link>
            <Link href="/items/new" className="btn btn-primary btn-sm">＋ 新建事项</Link>
            <HomeTopbarActions />
          </div>
        </header>

        <main className="redesign-dashboard">
          <header className="redesign-page-header">
            <div>
              <span>WORKSPACE PULSE</span>
              <h1>今日态势</h1>
              <p>{blockedCount} 阻塞待处理 · {overdueItems.length} 逾期需确认 · {p0Count + p1Count} P0/P1 高优 · {openActionItems.length} 待办行动项</p>
            </div>
            <div>
              <Link href="/export/today" className="btn btn-secondary btn-sm">↓ 导出日报</Link>
              <Link href="/reports" className="btn btn-primary btn-sm">今日汇报</Link>
            </div>
          </header>

          <KpiRow stats={stats} activeFocus={focus} />

          {focusView && (
            <Panel
              tag="FOCUS"
              title={focusLabels[focus!]}
              className="redesign-focus-panel"
              meta={<Link href="/" className="redesign-focus-clear">清除聚焦</Link>}
            >
              {focusView.kind === "items" ? (
                <div className="content-card-grid">
                  {focusView.items.map((item) => <WorkItemCard key={item.id} item={item} />)}
                </div>
              ) : (
                <div className="content-card-grid">
                  {focusView.logs.map((log) => <WorkLogCard key={log.id} log={log} />)}
                </div>
              )}
            </Panel>
          )}

          <div className="redesign-dashboard-columns">
            <section>
              <header className="redesign-column-header">
                <span>◆ ACTION ITEMS</span>
                <h2>行动项</h2>
                <small>{openActionItems.length} 待处理</small>
              </header>
              <Panel tag="01" title="待办行动项" meta="逾期 → 跟进中 → 待办">
                {actionRows.length === 0 ? (
                  <div className="redesign-empty">当前没有待处理的行动项。</div>
                ) : (
                  actionRows.map((row) => <AttnRow key={`${row.code}-${row.title}`} {...row} />)
                )}
                <Link href="/today" className="redesign-panel-footer-link">查看全部行动项 →</Link>
              </Panel>
            </section>

            <section>
              <header className="redesign-column-header">
                <span>◆ WORK ITEMS</span>
                <h2>事项</h2>
                <small>{attentionRows.length} 需关注 · {openCount} 未关闭</small>
              </header>
              <Panel tag="02" title="需要关注的事项" meta="阻塞 → P0 → 逾期 → P1">
                {attentionRows.length === 0 ? (
                  <div className="redesign-empty">当前没有需要优先关注的事项。</div>
                ) : (
                  attentionRows.map((row) => <AttnRow key={`${row.code}-${row.title}`} {...row} />)
                )}
                <Link href="/items" className="redesign-panel-footer-link">查看全部事项 →</Link>
              </Panel>
            </section>
          </div>

        </main>
      </div>
    </div>
  );
}
