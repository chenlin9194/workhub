import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import { formatTodayStr, getTodayRange, getTodayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
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

  const stats = [
    { label: "待处理", meta: "Open", value: openCount, icon: "inbox", tone: "blue" },
    { label: "跟进中", meta: "Following", value: followingCount, icon: "activity", tone: "cyan" },
    { label: "已阻塞", meta: "Blocked", value: blockedCount, icon: "shield-off", tone: "danger" },
    { label: "P0 紧急", meta: "Critical", value: p0Count, icon: "zap", tone: "critical" },
    { label: "P1 高优", meta: "High", value: p1Count, icon: "alert-triangle", tone: "warning" },
    { label: "今日日志", meta: "Today", value: todayLogsCount, icon: "file-text", tone: "purple" },
    { label: "今日关闭", meta: "Delivered", value: todayClosedCount, icon: "check-circle", tone: "success" },
  ];

  const flowSteps = [
    {
      key: "01",
      title: "Capture",
      icon: "edit",
      text: "记录今天发生的事实，例如会议结论、飞书摘录、问题进展",
    },
    {
      key: "02",
      title: "Track",
      icon: "target",
      text: "把需要闭环的风险、问题、待办沉淀为事项",
    },
    {
      key: "03",
      title: "Export",
      icon: "download",
      text: "导出事实上下文，交给外部 Claude/Codex 生成日报周报",
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
            <Link href="/logs/new" className="btn hero-btn-primary"><Icon name="edit" size={15} />记录今日进展</Link>
            <Link href="/items/new" className="btn hero-btn-secondary"><Icon name="plus" size={15} />新建跟踪事项</Link>
            <Link href="/today" className="btn hero-btn-secondary"><Icon name="calendar" size={15} />打开今日视图</Link>
            <Link href="/export/today" className="btn hero-btn-ghost"><Icon name="download" size={15} />导出日报</Link>
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
            <div className="workflow-icon"><Icon name={step.icon} size={19} /></div>
            <div>
              <div className="workflow-heading"><span>{step.key}</span>{step.title}</div>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div><span className="section-eyebrow">Live Overview</span><h2>交付态势</h2></div>
          <span className="section-live"><i />实时数据</span>
        </div>
        <div className="situation-grid">
          {stats.map((stat) => (
            <div key={stat.label} className={`stat-card stat-card-${stat.tone}`}>
              <div className="stat-topline">
                <span className="stat-icon"><Icon name={stat.icon} size={18} /></span>
                <span className="stat-meta">{stat.meta}</span>
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="deadline-grid">
        <div className="card deadline-panel">
          <div className="section-header">
            <span className="section-header-icon today"><Icon name="calendar" size={16} /></span>
            <span>今日到期事项</span>
            <span className="section-count">{todayDueItems.length} 项</span>
          </div>
          {todayDueItems.length === 0 ? (
            <div className="compact-empty">今日无到期事项</div>
          ) : todayDueItems.map((item) => <WorkItemCard key={item.id} item={item} />)}
        </div>

        <div className="card deadline-panel deadline-panel-risk">
          <div className="section-header section-header-risk">
            <span className="section-header-icon"><Icon name="alert-triangle" size={16} /></span>
            <span>逾期未关闭事项</span>
            <span className="section-count">{overdueItems.length} 项</span>
          </div>
          {overdueItems.length === 0 ? (
            <div className="compact-empty">无逾期事项，交付节奏良好</div>
          ) : overdueItems.map((item) => <WorkItemCard key={item.id} item={item} />)}
        </div>
      </section>

      <section>
        <div className="dashboard-section-title">
          <div><span className="section-eyebrow">Signal Stream</span><h2>最近日志</h2></div>
          <Link href="/logs" className="section-link">查看全部 <Icon name="chevron-right" size={14} /></Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon"><Icon name="file-text" size={28} /></div>
            <p>今天还没有工作日志。记录一条会议结论、飞书消息、问题进展或临时想法。</p>
            <div className="empty-actions">
              <Link href="/logs/new" className="btn btn-primary">记录今日进展</Link>
              <Link href="/items/new" className="btn btn-secondary">新建跟踪事项</Link>
            </div>
          </div>
        ) : (
          <div className="content-card-grid">{recentLogs.map((log) => <WorkLogCard key={log.id} log={log} />)}</div>
        )}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div><span className="section-eyebrow">Execution Queue</span><h2>最近更新事项</h2></div>
          <Link href="/items" className="section-link">查看全部 <Icon name="chevron-right" size={14} /></Link>
        </div>
        {recentItems.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon"><Icon name="clipboard-list" size={28} /></div>
            暂无事项，点击「新建跟踪事项」开始沉淀需要闭环的工作。
          </div>
        ) : (
          <div className="content-card-grid">{recentItems.map((item) => <WorkItemCard key={item.id} item={item} />)}</div>
        )}
      </section>
    </div>
  );
}
