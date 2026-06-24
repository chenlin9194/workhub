import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import { prisma } from "@/lib/prisma";
import { formatTodayStr, getTodayRange, getTodayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ focus?: string }>;
}

type WorkItemList = Awaited<ReturnType<typeof prisma.workItem.findMany>>;
type WorkLogList = Awaited<ReturnType<typeof prisma.workLog.findMany>>;

type FocusKey = "open" | "following" | "blocked" | "p0" | "p1" | "todayLogs" | "todayClosed";

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
  p0: "P0 紧急事项",
  p1: "P1 高优事项",
  todayLogs: "今日日志",
  todayClosed: "今日关闭事项",
};

function normalizeFocusKey(value?: string): FocusKey | null {
  if (!value) return null;

  const key = value.trim().toLowerCase();
  if (key === "open") return "open";
  if (key === "following") return "following";
  if (key === "blocked") return "blocked";
  if (key === "p0") return "p0";
  if (key === "p1") return "p1";
  if (key === "todaylogs") return "todayLogs";
  if (key === "todayclosed") return "todayClosed";

  return null;
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
  const today = getTodayStr();
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
    recentLogs,
    recentItems,
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
      orderBy: { priority: "asc" },
      take: 10,
    }),
    prisma.workItem.findMany({
      where: { dueDate: { lt: today }, status: { not: "closed" } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.workLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.workItem.findMany({ orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);

  const focusView = focus ? await loadFocusView(focus, today, todayStart, todayEnd) : null;

  const stats = [
    { label: "待处理", meta: "Open", value: openCount, icon: "inbox", tone: "blue", focus: "open" as const },
    { label: "跟进中", meta: "Following", value: followingCount, icon: "activity", tone: "cyan", focus: "following" as const },
    { label: "已阻塞", meta: "Blocked", value: blockedCount, icon: "shield-off", tone: "danger", focus: "blocked" as const },
    { label: "P0 紧急", meta: "Critical", value: p0Count, icon: "zap", tone: "critical", focus: "p0" as const },
    { label: "P1 高优", meta: "High", value: p1Count, icon: "alert-triangle", tone: "warning", focus: "p1" as const },
    { label: "今日日志", meta: "Today", value: todayLogsCount, icon: "file-text", tone: "purple", focus: "todayLogs" as const },
    { label: "今日关闭", meta: "Delivered", value: todayClosedCount, icon: "check-circle", tone: "success", focus: "todayClosed" as const },
  ];

  const flowSteps = [
    {
      key: "01",
      title: "Capture",
      icon: "edit",
      text: "记录今天发生的事实，例如会议结论、飞书摘录、问题进展。",
    },
    {
      key: "02",
      title: "Track",
      icon: "target",
      text: "把需要闭环的风险、问题、待办沉淀为事项。",
    },
    {
      key: "03",
      title: "Export",
      icon: "download",
      text: "导出事实上下文，交给外部 Claude/Codex 生成日报周报。",
    },
  ];

  return (
    <div className="dashboard-shell">
      <section className="dashboard-hero">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="hero-content">
          <div className="hero-kicker">
            <span className="hero-status-dot" />
            DELIVERY SYSTEM ONLINE
          </div>
          <h1>Local Work Hub</h1>
          <p className="hero-subtitle">OS Delivery Command Center</p>
          <p className="hero-date">{formatTodayStr()}</p>
          <div className="hero-situation">
            <Icon name="activity" size={17} />
            今日：{todayLogsCount} 条日志 · {p0Count + p1Count} 个高优事项 · {blockedCount} 个阻塞 · {overdueItems.length} 个逾期
          </div>
          <div className="hero-actions">
            <Link href="/logs/new" className="btn hero-btn-primary">
              <Icon name="edit" size={15} />
              记录今日日志
            </Link>
            <Link href="/items/new" className="btn hero-btn-secondary">
              <Icon name="plus" size={15} />
              新建跟踪事项
            </Link>
            <Link href="/today" className="btn hero-btn-secondary">
              <Icon name="calendar" size={15} />
              打开今日视图
            </Link>
            <Link href="/export/today" className="btn hero-btn-ghost">
              <Icon name="download" size={15} />
              导出日报
            </Link>
            <Link href="/stats" className="btn hero-btn-ghost">
              <Icon name="chart" size={15} />
              统计概览
            </Link>
          </div>
        </div>
        <div className="hero-system-mark" aria-hidden="true">
          <Icon name="cpu" size={34} />
          <span>OS / PM</span>
        </div>
      </section>

      <section className="workflow-grid" aria-label="Work Hub 工作流程">
        {flowSteps.map((step) => (
          <div key={step.key} className="workflow-card">
            <div className="workflow-icon">
              <Icon name={step.icon} size={19} />
            </div>
            <div>
              <div className="workflow-heading">
                <span>{step.key}</span>
                {step.title}
              </div>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">Live Overview</span>
            <h2>交付态势</h2>
          </div>
          <span className="section-live">
            <i />
            实时数据
          </span>
        </div>
        <div className="situation-grid">
          {stats.map((stat) => {
            const isActive = focus === stat.focus;

            return (
              <Link
                key={stat.label}
                href={`/?focus=${stat.focus}`}
                className={`stat-card stat-card-${stat.tone}${isActive ? " stat-card-active" : ""}`}
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
        <section>
          <div className="dashboard-section-title">
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
              <div className="card empty-state">
                <div className="empty-icon">
                  <Icon name="clipboard-list" size={28} />
                </div>
                <p>{focusView.emptyText}</p>
              </div>
            ) : (
              <div className="content-card-grid">
                {focusView.items.map((item) => (
                  <WorkItemCard key={item.id} item={item} />
                ))}
              </div>
            )
          ) : focusView.logs.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-icon">
                <Icon name="file-text" size={28} />
              </div>
              <p>{focusView.emptyText}</p>
            </div>
          ) : (
            <div className="content-card-grid">
              {focusView.logs.map((log) => (
                <WorkLogCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="deadline-grid">
        <div className="card deadline-panel">
          <div className="section-header">
            <span className="section-header-icon today">
              <Icon name="calendar" size={16} />
            </span>
            <span>今日到期事项</span>
            <span className="section-count">{todayDueItems.length} 项</span>
          </div>
          {todayDueItems.length === 0 ? (
            <div className="compact-empty">今日无到期事项</div>
          ) : (
            todayDueItems.map((item) => <WorkItemCard key={item.id} item={item} />)
          )}
        </div>

        <div className="card deadline-panel deadline-panel-risk">
          <div className="section-header section-header-risk">
            <span className="section-header-icon">
              <Icon name="alert-triangle" size={16} />
            </span>
            <span>逾期未关闭事项</span>
            <span className="section-count">{overdueItems.length} 项</span>
          </div>
          {overdueItems.length === 0 ? (
            <div className="compact-empty">无逾期事项，交付节奏良好</div>
          ) : (
            overdueItems.map((item) => <WorkItemCard key={item.id} item={item} />)
          )}
        </div>
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">Signal Stream</span>
            <h2>最近日志</h2>
          </div>
          <Link href="/logs" className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">
              <Icon name="file-text" size={28} />
            </div>
            <p>今天还没有工作日志。记录会议结论、飞书消息、问题进展或临时想法。</p>
            <div className="empty-actions">
              <Link href="/logs/new" className="btn btn-primary">
                记录今日日志
              </Link>
              <Link href="/items/new" className="btn btn-secondary">
                新建跟踪事项
              </Link>
            </div>
          </div>
        ) : (
          <div className="content-card-grid">
            {recentLogs.map((log) => (
              <WorkLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">Execution Queue</span>
            <h2>最近更新事项</h2>
          </div>
          <Link href="/items" className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {recentItems.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">
              <Icon name="clipboard-list" size={28} />
            </div>
            <p>暂无事项，点击“新建跟踪事项”开始沉淀需要闭环的工作。</p>
          </div>
        ) : (
          <div className="content-card-grid">
            {recentItems.map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
