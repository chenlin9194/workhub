import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import HomeTopbarActions from "@/components/HomeTopbarActions";
import { prisma } from "@/lib/prisma";
import { formatTodayStr, getLocalDateString, getTodayRange } from "@/lib/utils";
import {
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

type FocusKey = "open" | "following" | "blocked" | "overdue" | "p0" | "p1" | "todayLogs" | "todayClosed";

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

function getProjectFocusText(
  projects: {
    items: { id: string }[];
    code: string | null;
    name: string;
    currentSummary: string | null;
    nextMilestone: string | null;
    nextAction: string | null;
  }[]
) {
  const project = projects.find((item) => item.items.length > 0 && (item.nextAction || item.nextMilestone || item.currentSummary)) ?? projects[0];
  if (!project) return "当前没有进行中项目需要额外提示";

  const projectName = project.code || project.name;
  const focus = project.nextAction || project.nextMilestone || project.currentSummary;
  if (!focus) return `${projectName} 需要保持例行跟进`;

  return `${projectName} 仍需跟进${focus}`;
}

function getBannerJudgement({
  blockedCount,
  p0Count,
  p1Count,
  overdueCount,
  focusText,
}: {
  blockedCount: number;
  p0Count: number;
  p1Count: number;
  overdueCount: number;
  focusText: string;
}) {
  const riskParts = [];
  if (blockedCount > 0) riskParts.push(`${blockedCount} 个阻塞`);
  if (p0Count > 0) riskParts.push(`${p0Count} 个 P0`);
  if (overdueCount > 0) riskParts.push(`${overdueCount} 个逾期`);

  const riskText = riskParts.length > 0 ? `当前需优先处理 ${riskParts.join("、")}` : "当前无阻塞";
  const p1Text = p1Count > 0 ? `P1 高优 ${p1Count} 项` : "暂无 P1 高优积压";

  return `${riskText}，${p1Text}，${focusText}`;
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
  if (item.dueDate && item.dueDate < today) return "Overdue";
  if (item.priority === "P0") return "P0";
  if (item.status === "blocked") return "Blocked";
  if (item.priority === "P1") return "P1";
  if (item.status === "following") return "Following";
  return "Due soon";
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
      take: 6,
    }),
  ]);

  const focusView = focus ? await loadFocusView(focus, today, todayStart, todayEnd) : null;
  const primaryAttentionItems = uniqueItems([...overdueItems, ...p0Items, ...blockedItems]);
  const fallbackAttentionItems = uniqueItems([...p1Items, ...followingItems, ...upcomingItems]);
  const attentionItems = (primaryAttentionItems.length > 0 ? primaryAttentionItems : fallbackAttentionItems).slice(0, 7);
  const todayItems = uniqueItems([...todayDueItems, ...recentItems]).slice(0, 8);
  const bannerJudgement = getBannerJudgement({
    blockedCount,
    p0Count,
    p1Count,
    overdueCount: overdueItems.length,
    focusText: getProjectFocusText(activeProjects),
  });

  const stats = [
    { label: "待处理", meta: "OPEN", value: openCount, icon: "inbox", tone: "blue", focus: "open" as const },
    { label: "跟进中", meta: "FOLLOWING", value: followingCount, icon: "activity", tone: "cyan", focus: "following" as const },
    { label: "已阻塞", meta: "BLOCKED", value: blockedCount, icon: "shield-off", tone: "danger", focus: "blocked" as const },
    { label: "P0 紧急", meta: "P0", value: p0Count, icon: "zap", tone: "critical", focus: "p0" as const },
    { label: "P1 高优", meta: "P1", value: p1Count, icon: "alert-triangle", tone: "warning", focus: "p1" as const },
    { label: "今日日志", meta: "TODAY", value: todayLogsCount, icon: "file-text", tone: "purple", focus: "todayLogs" as const },
    { label: "今日关闭", meta: "DONE", value: todayClosedCount, icon: "check-circle", tone: "success", focus: "todayClosed" as const },
  ];

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

        <main className="cockpit-grid">
          <section className="cockpit-main-column">
            <section className="dashboard-hero command-banner">
              <div className="hero-orbit hero-orbit-one" />
              <div className="hero-orbit hero-orbit-two" />
              <div className="hero-content">
                <div className="hero-kicker">
                  <span className="hero-status-dot" />
                  LOCAL WORK HUB
                </div>
                <h1>当前交付上下文</h1>
                <p className="hero-subtitle">{formatTodayStr()} · 首页态势总览</p>
                <p className="banner-judgement">{bannerJudgement}</p>
                <div className="banner-summary-grid" aria-label="当前态势摘要">
                  <Link href={getDashboardFocusHref("blocked")}>
                    <span>阻塞</span>
                    <strong>{blockedCount}</strong>
                  </Link>
                  <Link href={getDashboardFocusHref("p0")}>
                    <span>P0 紧急</span>
                    <strong>{p0Count}</strong>
                  </Link>
                  <Link href={getDashboardFocusHref("overdue")}>
                    <span>逾期</span>
                    <strong>{overdueItems.length}</strong>
                  </Link>
                  <Link href={getDashboardFocusHref("todayLogs")}>
                    <span>今日日志</span>
                    <strong>{todayLogsCount}</strong>
                  </Link>
                </div>
                <div className="hero-actions">
                  <Link href="/logs/new" className="btn hero-btn-primary">
                    <Icon name="edit" size={15} />
                    记录今日日志
                  </Link>
                  <Link href="/items/new" className="btn hero-btn-secondary">
                    <Icon name="plus" size={15} />
                    新建事项
                  </Link>
                  <Link href="/export/today" className="btn hero-btn-secondary">
                    <Icon name="download" size={15} />
                    导出日报
                  </Link>
                  <Link href="/today" className="btn hero-btn-ghost">
                    <Icon name="calendar" size={15} />
                    今日视图
                  </Link>
                </div>
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
              <div className="situation-grid cockpit-metrics">
                {stats.map((stat) => {
                  const isActive = focus === stat.focus;
                  const statTone = stat.value > 0 ? stat.tone : "neutral";

                  return (
                    <Link
                      key={stat.meta}
                      href={getDashboardFocusHref(stat.focus)}
                      scroll={false}
                      className={`stat-card stat-card-${statTone}${isActive ? " stat-card-active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <div className="stat-topline">
                        <span className="stat-icon">
                          <Icon name={stat.icon} size={18} />
                        </span>
                        <span className="stat-meta">{stat.meta}</span>
                      </div>
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                    </Link>
                  );
                })}
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
                  <span className="section-eyebrow">Today Queue</span>
                  <h2>今日事项</h2>
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

            <section className="card cockpit-card">
              <div className="cockpit-card-head">
                <div>
                  <span className="section-eyebrow">Portfolio</span>
                  <h2>项目态势</h2>
                </div>
                <Link href="/projects" className="section-link">
                  全部 <Icon name="chevron-right" size={14} />
                </Link>
              </div>
              <div className="portfolio-list">
                {activeProjects.length === 0 ? (
                  <div className="compact-empty">当前没有进行中或规划中的项目。</div>
                ) : (
                  activeProjects.map((project) => (
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
                  ))
                )}
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
