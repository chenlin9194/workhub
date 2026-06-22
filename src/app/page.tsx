import { prisma } from "@/lib/prisma";
import Link from "next/link";
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
    prisma.workLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.workItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const stats = [
    { label: "待处理", value: openCount, color: "var(--accent-blue)" },
    { label: "跟进中", value: followingCount, color: "var(--accent-green)" },
    { label: "已阻塞", value: blockedCount, color: "var(--accent-orange)" },
    { label: "P0 紧急", value: p0Count, color: "#dc2626" },
    { label: "P1 高优", value: p1Count, color: "var(--accent-red)" },
    { label: "今日日志", value: todayLogsCount, color: "var(--accent-purple)" },
    { label: "今日关闭", value: todayClosedCount, color: "var(--accent-green)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{formatTodayStr()}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/logs/new" className="btn btn-primary">+ 记录今日进展</Link>
          <Link href="/items/new" className="btn btn-secondary">+ 新建跟踪事项</Link>
        </div>
      </div>

      {/* How to use */}
      <div className="card" style={{ padding: 20, background: "var(--bg-secondary)" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>💡 如何使用 Work Hub？</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <p><strong>日志</strong>：记录今天发生的事实，例如会议结论、飞书摘录、问题进展。</p>
          <p><strong>事项</strong>：跟踪需要闭环的工作，例如风险、问题、待办、跨团队依赖。</p>
          <p><strong>推荐流程</strong>：先记录日志；如果需要持续跟进，再关联或创建事项。</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-value" style={{ color: s.value > 0 ? s.color : "var(--text-tertiary)" }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today Due & Overdue */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
        {/* Today Due */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="section-header">
            <span>今日到期事项</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)", fontWeight: 400 }}>
              {todayDueItems.length} 项
            </span>
          </div>
          {todayDueItems.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              今日无到期事项
            </div>
          ) : (
            <div>
              {todayDueItems.map((item) => (
                <WorkItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="section-header" style={{ background: "var(--accent-red)", color: "white" }}>
            <span>逾期未关闭事项</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 400 }}>
              {overdueItems.length} 项
            </span>
          </div>
          {overdueItems.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              无逾期事项
            </div>
          ) : (
            <div>
              {overdueItems.map((item) => (
                <WorkItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Logs */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>最近日志</h2>
          <Link href="/logs" style={{ fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}>
            查看全部 →
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
              今天还没有工作日志。你可以记录一条会议结论、飞书消息、问题进展或临时想法。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Link href="/logs/new" className="btn btn-primary">记录今日进展</Link>
              <Link href="/items/new" className="btn btn-secondary">新建跟踪事项</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {recentLogs.map((log) => (
              <WorkLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Items */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>最近更新事项</h2>
          <Link href="/items" style={{ fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}>
            查看全部 →
          </Link>
        </div>
        {recentItems.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">📋</div>
            暂无事项，点击「新建跟踪事项」开始，事项用于跟踪需要闭环的风险、问题、待办或跨团队依赖
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {recentItems.map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
