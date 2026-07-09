import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import HomeTopbarActions from "@/components/HomeTopbarActions";
import { prisma } from "@/lib/prisma";
import { formatTodayStr, getLocalDateString, getTodayRange } from "@/lib/utils";
import {
  ACTION_ITEM_STATUS_LABELS,
  PRIORITY_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ focus?: string }>;
}

type WorkItemList = Awaited<ReturnType<typeof prisma.workItem.findMany>>;
type WorkLogList = Awaited<ReturnType<typeof prisma.workLog.findMany>>;
type DashboardItem = WorkItemList[number];
type DashboardActionItem = Awaited<ReturnType<typeof prisma.actionItem.findMany>>[number] & {
  workItem?: { id: string; title: string } | null;
  workLog?: { id: string; title: string } | null;
  project?: { id: string; name: string; code: string | null } | null;
};

type FocusKey = "open" | "following" | "blocked" | "overdue" | "p0" | "p1" | "todayLogs" | "todayClosed";
type StatConfig = {
  label: string;
  meta: string;
  value: number;
  icon: string;
  tone: string;
  focus: FocusKey;
  group: "risk" | "flow";
};

type FocusView =
  | {
      key: FocusKey;
      kind: "items";
      title: string;
      emptyText: string;
      items: WorkItemList;
    }
  | {
      key: FocusKey;
      kind: "logs";
      title: string;
      emptyText: string;
      logs: WorkLogList;
    };

const FOCUS_LABELS: Record<FocusKey, string> = {
  open: "待处理事项",
  following: "跟进中事项",
  blocked: "已阻塞事项",
  overdue: "逾期事项",
  p0: "P0 紧急事项",
  p1: "P1 高优事项",
  todayLogs: "今日日志",
  todayClosed: "今日关闭事项",
};

const sidebarNav = [
  { href: "/", label: "工作台", icon: "home", active: true },
  { href: "/projects", label: "项目", icon: "folder" },
  { href: "/items", label: "事项", icon: "list" },
  { href: "/logs", label: "日志", icon: "file-text" },
  { href: "/reports", label: "汇报", icon: "chart" },
];

const toolLinks = [
  { href: "/today", label: "今日视图", icon: "calendar" },
  { href: "/export/today", label: "导出日报", icon: "download" },
  { href: "/stats", label: "统计概览", icon: "activity" },
  { href: "/settings/tools", label: "工具入口", icon: "settings" },
];

function normalizeFocusKey(value?: string): FocusKey | null {
  if (!value) return null;

  const key = value.trim().toLowerCase();
  if (key === "open") return "open";
  if (key === "following") return "following";
  if (key === "blocked") return "blocked";
  if (key === "overdue") return "overdue";
  if (key === "p0") return "p0";
  if (key === "p1") return "p1";
  if (key === "todaylogs") return "todayLogs";
  if (key === "todayclosed") return "todayClosed";

  return null;
}

function getDashboardFocusHref(focus: FocusKey) {
  return `/?focus=${focus}`;
}

function getShortDate(value?: string | Date | null) {
  if (!value) return "未设定";
  return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function getTags(tags?: string | null) {
  if (!tags) return [];
  return tags
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function uniqueItems(items: DashboardItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getBannerJudgement({
  blockedCount,
  p0Count,
  p1Count,
  overdueCount,
  actionItemCount,
}: {
  blockedCount: number;
  p0Count: number;
  p1Count: number;
  overdueCount: number;
  actionItemCount: number;
}) {
  const pressureParts = [];
  if (blockedCount > 0) pressureParts.push(`${blockedCount} 个阻塞待处理`);
  if (overdueCount > 0) pressureParts.push(`${overdueCount} 个逾期需确认`);

  const riskText = pressureParts.length > 0 ? pressureParts.join("；") : "阻塞和逾期压力较低";
  const actionText = actionItemCount > 0 ? `${actionItemCount} 个行动项需要跟进` : "暂无未处理行动项";
  const priorityText = p0Count + p1Count > 0 ? `P0/P1 高优 ${p0Count + p1Count} 项` : "P0/P1 高优压力较低";

  return `今日重点：${riskText}；${actionText}；${priorityText}。`;
}

function getActionItemRank(action: DashboardActionItem, today: string) {
  if (action.dueDate && action.dueDate < today) return 0;
  if (action.status === "pending") return 1;
  if (action.status === "in_progress") return 2;
  if (action.dueDate) return 3;
  return 4;
}

function sortDashboardActionItems(actions: DashboardActionItem[], today: string) {
  return [...actions].sort((a, b) => {
    const rankDiff = getActionItemRank(a, today) - getActionItemRank(b, today);
    if (rankDiff !== 0) return rankDiff;

    const aDue = a.dueDate || "9999-12-31";
    const bDue = b.dueDate || "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function CompactTaskRow({ item }: { item: DashboardItem }) {
  const tags = getTags(item.tags);

  return (
    <details className="cockpit-task-row">
      <summary>
        <span className={`badge badge-${item.priority.toLowerCase()}`}>
          {PRIORITY_LABELS[item.priority] || item.priority}
        </span>
        <span className={`badge badge-${item.status}`}>
          {STATUS_LABELS[item.status] || item.status}
        </span>
        <strong>{item.title}</strong>
        <span className="cockpit-task-date">{item.dueDate || getShortDate(item.updatedAt)}</span>
        <Icon name="chevron-right" size={13} />
      </summary>
      <div className="cockpit-task-detail">
        <p>
          <span>当前进展</span>
          {item.currentSummary || item.description || "当前进展待补充。"}
        </p>
        <p>
          <span>Next Action</span>
          {item.nextAction || "下一步动作待补充。"}
        </p>
        <div className="cockpit-task-tags">
          {item.project && <span>{item.project}</span>}
          {item.module && <span>{item.module}</span>}
          {item.owner && <span>{item.owner}</span>}
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <Link href={`/items/${item.id}`} className="cockpit-inline-link">
          打开事项 <Icon name="chevron-right" size={12} />
        </Link>
      </div>
    </details>
  );
}

function DashboardActionRow({ action, today }: { action: DashboardActionItem; today: string }) {
  const href = action.workItemId
    ? `/items/${action.workItemId}`
    : action.workLogId
      ? `/logs/${action.workLogId}`
      : undefined;
  const isOverdue = Boolean(action.dueDate && action.dueDate < today);
  const parentTitle = action.workItem?.title || action.workLog?.title;
  const parentType = action.workItem ? "事项" : action.workLog ? "日志" : null;
  const sourceParts = [
    action.owner ? `负责人：${action.owner}` : null,
    action.project ? `项目：${action.project.code || action.project.name}` : null,
    parentTitle && parentType ? `来源${parentType}：${parentTitle}` : null,
  ].filter(Boolean);

  const content = (
    <>
      <span className={`dashboard-action-status${isOverdue ? " is-overdue" : ""}`}>
        {isOverdue ? "逾期" : ACTION_ITEM_STATUS_LABELS[action.status] || action.status}
      </span>
      <div className="dashboard-action-main">
        <strong>{action.title}</strong>
        <span>{sourceParts.length > 0 ? sourceParts.join(" · ") : "未关联事项或日志"}</span>
      </div>
      <span className={`dashboard-action-due${isOverdue ? " is-overdue" : ""}`}>
        {action.dueDate ? action.dueDate : "未设截止"}
      </span>
      {href && (
        <span className="dashboard-action-arrow" aria-hidden="true">
          <Icon name="chevron-right" size={13} />
        </span>
      )}
    </>
  );

  const rowClassName = `dashboard-action-row dashboard-action-row--${isOverdue ? "overdue" : action.status}${href ? " is-clickable" : ""}`;

  return href ? (
    <Link href={href} className={rowClassName}>
      {content}
    </Link>
  ) : (
    <div className={rowClassName}>{content}</div>
  );
}

function DashboardStatCard({ stat, active }: { stat: StatConfig; active: boolean }) {
  const statTone = stat.value > 0 ? stat.tone : "neutral";
  const className = `stat-card stat-card-${statTone}${active ? " stat-card-active" : ""}${stat.value === 0 ? " stat-card-empty" : ""}`;
  const content = (
    <>
      <div className="stat-topline">
        <span className="stat-icon">
          <Icon name={stat.icon} size={18} />
        </span>
        <span className="stat-meta">{stat.meta}</span>
      </div>
      <div className="stat-value">{stat.value}</div>
      <div className="stat-label">{stat.label}</div>
    </>
  );

  if (stat.value === 0 && !active) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      href={getDashboardFocusHref(stat.focus)}
      scroll={false}
      className={`${className} stat-card-clickable`}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </Link>
  );
}

function AttentionRow({ item, reason }: { item: DashboardItem; reason: string }) {
  return (
    <Link href={`/items/${item.id}`} className="attention-row">
      <span className="attention-reason">{reason}</span>
      <strong>{item.title}</strong>
      <span>{item.dueDate ? `到期 ${item.dueDate}` : STATUS_LABELS[item.status] || item.status}</span>
    </Link>
  );
}

function getAttentionReason(item: DashboardItem, today: string) {
  if (item.dueDate && item.dueDate < today) return "逾期";
  if (item.priority === "P0") return "P0";
  if (item.status === "blocked") return "阻塞";
  if (item.priority === "P1") return "P1";
  if (item.status === "following") return "跟进";
  return "临近";
}

async function loadFocusView(focus: FocusKey, today: string, todayStart: Date, todayEnd: Date): Promise<FocusView> {
  switch (focus) {
    case "open": {
      const items = await prisma.workItem.findMany({
        where: { status: "open" },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "items", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "当前没有待处理事项。", items };
    }
    case "following": {
      const items = await prisma.workItem.findMany({
        where: { status: "following" },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "items", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "当前没有跟进中事项。", items };
    }
    case "blocked": {
      const items = await prisma.workItem.findMany({
        where: { status: "blocked" },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "items", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "当前没有阻塞事项。", items };
    }
    case "overdue": {
      const items = await prisma.workItem.findMany({
        where: { dueDate: { lt: today }, status: { not: "closed" } },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        take: 20,
      });

      return {
        key: focus,
        kind: "items",
        title: `聚焦视图：${FOCUS_LABELS[focus]}`,
        emptyText: "当前没有逾期事项，交付节奏稳定。",
        items,
      };
    }
    case "p0": {
      const items = await prisma.workItem.findMany({
        where: { priority: "P0", status: { not: "closed" } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "items", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "当前没有 P0 紧急事项。", items };
    }
    case "p1": {
      const items = await prisma.workItem.findMany({
        where: { priority: "P1", status: { not: "closed" } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "items", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "当前没有 P1 高优事项。", items };
    }
    case "todayLogs": {
      const logs = await prisma.workLog.findMany({
        where: { workDate: today },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "logs", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "今天还没有日志。", logs };
    }
    case "todayClosed": {
      const items = await prisma.workItem.findMany({
        where: { closedAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { closedAt: "desc" },
        take: 20,
      });

      return { key: focus, kind: "items", title: `聚焦视图：${FOCUS_LABELS[focus]}`, emptyText: "今天还没有关闭事项。", items };
    }
    default:
      throw new Error(`Unsupported focus key: ${focus}`);
  }
}

export default async function Dashboard({ searchParams }: PageProps) {
  const { focus: rawFocus } = await searchParams;
  const focus = normalizeFocusKey(rawFocus);
  const today = getLocalDateString();
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const dueSoonEnd = getLocalDateString(soon);
  const { start: todayStart, end: todayEnd } = getTodayRange();

  const [
    openCount,
    followingCount,
    blockedCount,
    p0Count,
    p1Count,
    todayLogsCount,
    todayClosedCount,
    todayDueItems,
    overdueItems,
    p0Items,
    blockedItems,
    p1Items,
    followingItems,
    upcomingItems,
    recentItems,
    openActionItemCount,
    openActionItems,
    activeProjects,
  ] = await Promise.all([
    prisma.workItem.count({ where: { status: "open" } }),
    prisma.workItem.count({ where: { status: "following" } }),
    prisma.workItem.count({ where: { status: "blocked" } }),
    prisma.workItem.count({ where: { priority: "P0", status: { not: "closed" } } }),
    prisma.workItem.count({ where: { priority: "P1", status: { not: "closed" } } }),
    prisma.workLog.count({ where: { workDate: today } }),
    prisma.workItem.count({ where: { closedAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.workItem.findMany({
      where: { dueDate: today, status: { not: "closed" } },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.workItem.findMany({
      where: { dueDate: { lt: today }, status: { not: "closed" } },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
      take: 8,
    }),
    prisma.workItem.findMany({
      where: { priority: "P0", status: { not: "closed" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.workItem.findMany({
      where: { status: "blocked" },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.workItem.findMany({
      where: { priority: "P1", status: { not: "closed" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.workItem.findMany({
      where: { status: "following" },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.workItem.findMany({
      where: { dueDate: { gt: today, lte: dueSoonEnd }, status: { not: "closed" } },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
      take: 6,
    }),
    prisma.workItem.findMany({
      where: { status: { not: "closed" } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.actionItem.count({ where: { status: { not: "done" } } }),
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
    prisma.project.findMany({
      where: { status: { in: ["active", "planning"] } },
      include: {
        _count: { select: { items: true } },
        items: {
          where: { OR: [{ health: "red" }, { status: "blocked" }] },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const focusView = focus ? await loadFocusView(focus, today, todayStart, todayEnd) : null;
  const primaryAttentionItems = uniqueItems([...overdueItems, ...p0Items, ...blockedItems]);
  const fallbackAttentionItems = uniqueItems([...p1Items, ...followingItems, ...upcomingItems]);
  const attentionItems = (primaryAttentionItems.length > 0 ? primaryAttentionItems : fallbackAttentionItems).slice(0, 3);
  const todayItems = uniqueItems([...todayDueItems, ...recentItems]).slice(0, 8);
  const sortedActionItems = sortDashboardActionItems(openActionItems, today);
  const visibleActionItems = sortedActionItems.slice(0, 5);
  const hasMoreActionItems = openActionItemCount > visibleActionItems.length;
  const riskyPortfolioProjects = activeProjects
    .filter((project) => project.items.length > 0 || project.health === "red" || project.health === "yellow")
    .slice(0, 3);
  const bannerJudgement = getBannerJudgement({
    blockedCount,
    p0Count,
    p1Count,
    overdueCount: overdueItems.length,
    actionItemCount: openActionItemCount,
  });

  const stats: StatConfig[] = [
    { label: "已阻塞", meta: "BLOCKED", value: blockedCount, icon: "shield-off", tone: "danger", focus: "blocked", group: "risk" },
    { label: "P0 紧急", meta: "P0", value: p0Count, icon: "zap", tone: "critical", focus: "p0", group: "risk" },
    { label: "P1 高优", meta: "P1", value: p1Count, icon: "alert-triangle", tone: "warning", focus: "p1", group: "risk" },
    { label: "已逾期", meta: "OVERDUE", value: overdueItems.length, icon: "clock", tone: "danger", focus: "overdue", group: "risk" },
    { label: "待处理", meta: "OPEN", value: openCount, icon: "inbox", tone: "blue", focus: "open", group: "flow" },
    { label: "跟进中", meta: "FOLLOWING", value: followingCount, icon: "activity", tone: "cyan", focus: "following", group: "flow" },
    { label: "今日日志", meta: "TODAY", value: todayLogsCount, icon: "file-text", tone: "purple", focus: "todayLogs", group: "flow" },
    { label: "今日关闭", meta: "DONE", value: todayClosedCount, icon: "check-circle", tone: "success", focus: "todayClosed", group: "flow" },
  ];
  const riskStats = stats.filter((stat) => stat.group === "risk");
  const flowStats = stats.filter((stat) => stat.group === "flow");

  return (
    <div className="dashboard-shell">
      <aside className="cockpit-sidebar" aria-label="首页导航">
        <Link href="/" className="cockpit-brand">
          <span className="cockpit-brand-mark">
            <Icon name="clipboard-list" size={18} />
          </span>
          <span>
            <strong>Work Hub</strong>
            <small>Local Console</small>
          </span>
        </Link>

        <div className="cockpit-nav-group">
          <span className="cockpit-nav-label">PRIMARY</span>
          {sidebarNav.map((item) => (
            <Link key={item.href} href={item.href} className={`cockpit-nav-item${item.active ? " is-active" : ""}`}>
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="cockpit-nav-group">
          <span className="cockpit-nav-label">TOOLS</span>
          {toolLinks.map((item) => (
            <Link key={item.href} href={item.href} className="cockpit-nav-item">
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      <div className="cockpit-content">
        <header className="cockpit-topbar">
          <div>
            <span className="cockpit-path">工作台 / Cockpit Dashboard</span>
            <strong>{formatTodayStr()}</strong>
          </div>
          <form action="/items" className="cockpit-search">
            <Icon name="search" size={14} />
            <input type="hidden" name="visibility" value="open" />
            <input name="keyword" placeholder="搜索事项、项目、责任人" />
          </form>
          <HomeTopbarActions />
        </header>

        <main className="cockpit-grid cockpit-grid--today-entry">
          <section className="dashboard-toolbar daily-command-banner" aria-label="今日工作台摘要">
            <div className="hero-content">
              <div className="hero-title-stack">
                <div className="hero-kicker">
                  <span className="hero-status-dot" />
                  LOCAL WORK HUB
                </div>
                <h1>今日工作台</h1>
                <p className="hero-subtitle">今日执行入口</p>
              </div>
              <div className="hero-summary-stack">
                <p className="banner-judgement">{bannerJudgement}</p>
                <div className="hero-signal-chips" aria-label="交付风险信号">
                  {blockedCount > 0 && <span className="hero-signal-chip is-risk">阻塞 {blockedCount}</span>}
                  {p0Count > 0 && <span className="hero-signal-chip is-risk">P0 {p0Count}</span>}
                  {p1Count > 0 && <span className="hero-signal-chip is-warning">P1 {p1Count}</span>}
                  {overdueItems.length > 0 && <span className="hero-signal-chip is-risk">逾期 {overdueItems.length}</span>}
                </div>
              </div>
              <div className="hero-actions">
                <Link href="/logs/new" className="btn hero-btn-primary">
                  <Icon name="edit" size={15} />
                  记录今日日志
                </Link>
                <Link href="/items/new?actionItems=1" className="btn hero-btn-secondary">
                  <Icon name="clipboard-list" size={15} />
                  新增行动项
                </Link>
                <Link href="/items/new" className="btn hero-btn-secondary">
                  <Icon name="plus" size={15} />
                  新建事项
                </Link>
                <Link href="/export/today" className="btn hero-btn-ghost">
                  <Icon name="download" size={15} />
                  导出日报
                </Link>
              </div>
            </div>
          </section>

          <section className="cockpit-main-column">
            <section className="card cockpit-card dashboard-action-card">
              <div className="cockpit-card-head">
                <div>
                  <span className="section-eyebrow">Action Items</span>
                  <h2>今日行动项</h2>
                  <p className="section-brief">今天需要处理、确认、推进的具体动作。</p>
                </div>
                <div className="section-head-actions">
                  <span className="section-count">{openActionItemCount} 项</span>
                  {hasMoreActionItems && (
                    <Link href="/today" className="section-link">
                      查看全部 <Icon name="chevron-right" size={14} />
                    </Link>
                  )}
                </div>
              </div>
              <div className="dashboard-action-list">
                {visibleActionItems.length === 0 ? (
                  <div className="compact-empty">当前没有未处理行动项。</div>
                ) : (
                  visibleActionItems.map((action) => (
                    <DashboardActionRow key={action.id} action={action} today={today} />
                  ))
                )}
              </div>
            </section>

            <section className="card cockpit-card">
              <div className="cockpit-card-head">
                <div>
                  <span className="section-eyebrow">Live Overview</span>
                  <h2>交付态势</h2>
                </div>
                <span className="section-live">
                  <i />
                  实时数据
                </span>
              </div>
              <div className="dashboard-stat-groups">
                <div className="dashboard-stat-group dashboard-stat-group--risk">
                  <span className="dashboard-stat-group-label">风险态势</span>
                  <div className="situation-grid cockpit-metrics">
                    {riskStats.map((stat) => (
                      <DashboardStatCard key={stat.meta} stat={stat} active={focus === stat.focus} />
                    ))}
                  </div>
                </div>
                <div className="dashboard-stat-group dashboard-stat-group--flow">
                  <span className="dashboard-stat-group-label">流转态势</span>
                  <div className="situation-grid cockpit-metrics">
                    {flowStats.map((stat) => (
                      <DashboardStatCard key={stat.meta} stat={stat} active={focus === stat.focus} />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {focusView && (
              <section className="card cockpit-card cockpit-focus-card">
                <div className="cockpit-card-head">
                  <div>
                    <span className="section-eyebrow">Focus View</span>
                    <h2>{focusView.title}</h2>
                  </div>
                  <span className="section-live">
                    <i />
                    {focusView.kind === "items" ? `${focusView.items.length} 项` : `${focusView.logs.length} 条`}
                  </span>
                </div>
                {focusView.kind === "items" ? (
                  focusView.items.length === 0 ? (
                    <div className="compact-empty">{focusView.emptyText}</div>
                  ) : (
                    <div className="content-card-grid">
                      {focusView.items.map((item) => (
                        <WorkItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  )
                ) : focusView.logs.length === 0 ? (
                  <div className="compact-empty">{focusView.emptyText}</div>
                ) : (
                  <div className="content-card-grid">
                    {focusView.logs.map((log) => (
                      <WorkLogCard key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="card cockpit-card">
              <div className="cockpit-card-head">
                <div>
                  <span className="section-eyebrow">Tracking Queue</span>
                  <h2>事项队列</h2>
                  <p className="section-brief">需要持续关注的事项状态。</p>
                </div>
                <Link href="/items" className="section-link">
                  查看全部 <Icon name="chevron-right" size={14} />
                </Link>
              </div>
              <div className="cockpit-task-list">
                {todayItems.length === 0 ? (
                  <div className="compact-empty">当前没有需要今天处理的事项，交付节奏稳定。</div>
                ) : (
                  todayItems.map((item) => <CompactTaskRow key={item.id} item={item} />)
                )}
              </div>
            </section>
          </section>

          <aside className="cockpit-side-column">
            <section className="card cockpit-card">
              <div className="cockpit-card-head">
                <div>
                  <span className="section-eyebrow">Need Attention</span>
                  <h2>今日焦点</h2>
                </div>
                <span className="section-count">{attentionItems.length} 项</span>
              </div>
              <div className="attention-list">
                {attentionItems.length === 0 ? (
                  <div className="attention-ok">
                    <Icon name="check-circle" size={18} />
                    当前没有 P0、阻塞、逾期或临近到期事项。
                  </div>
                ) : (
                  attentionItems.map((item) => (
                    <AttentionRow key={item.id} item={item} reason={getAttentionReason(item, today)} />
                  ))
                )}
              </div>
            </section>

            <section className={`card cockpit-card portfolio-card${riskyPortfolioProjects.length === 0 ? " portfolio-card--quiet" : ""}`}>
              <div className="cockpit-card-head">
                <div>
                  <span className="section-eyebrow">Portfolio</span>
                  <h2>项目态势</h2>
                </div>
                <Link href="/projects" className="section-link">
                  全部 <Icon name="chevron-right" size={14} />
                </Link>
              </div>
              {riskyPortfolioProjects.length === 0 ? (
                <div className="portfolio-quiet-empty">暂无需重点关注项目</div>
              ) : (
                <div className="portfolio-list">
                  {riskyPortfolioProjects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="portfolio-row">
                      <span className="portfolio-code">{project.code || "NO-CODE"}</span>
                      <strong>{project.name}</strong>
                      <span className="entity-pill entity-pill--muted">
                        {PROJECT_STATUS_LABELS[project.status] || project.status}
                      </span>
                      <span>{project._count.items} 事项</span>
                      <span>{project.stage ? PROJECT_STAGE_LABELS[project.stage] || project.stage : "阶段未设定"}</span>
                      <small>{project.currentSummary || project.nextMilestone || project.nextAction || "暂无备注"}</small>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
