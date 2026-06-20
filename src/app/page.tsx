import { prisma } from "@/lib/prisma";
import Link from "next/link";
import NoteCard from "@/components/NoteCard";
import { getTodayRange, formatTodayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { start, end } = getTodayRange();

  const [totalCount, todayCount, todayTodos, todayRisks, todayBlockers, todayDecisions, openCount, recentNotes] =
    await Promise.all([
      prisma.note.count(),
      prisma.note.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.note.count({ where: { createdAt: { gte: start, lt: end }, type: "todo", status: { not: "closed" } } }),
      prisma.note.count({ where: { createdAt: { gte: start, lt: end }, type: "risk" } }),
      prisma.note.count({ where: { createdAt: { gte: start, lt: end }, type: "blocker", status: { not: "closed" } } }),
      prisma.note.count({ where: { createdAt: { gte: start, lt: end }, type: "decision" } }),
      prisma.note.count({ where: { status: { not: "closed" } } }),
      prisma.note.findMany({ orderBy: { createdAt: "desc" }, take: 9 }),
    ]);

  const stats = [
    { label: "今日记录", value: todayCount, color: "var(--accent-blue)" },
    { label: "今日待办", value: todayTodos, color: "var(--accent-orange)" },
    { label: "今日风险", value: todayRisks, color: "var(--accent-red)" },
    { label: "今日阻塞", value: todayBlockers, color: "#dc2626" },
    { label: "今日决策", value: todayDecisions, color: "var(--accent-green)" },
    { label: "待处理", value: openCount, color: "var(--accent-purple)" },
    { label: "总记录", value: totalCount, color: "var(--text-secondary)" },
  ];

  const quickActions = [
    { href: "/notes/new", label: "新增记录", desc: "快速记录工作信息", icon: "plus", color: "var(--accent-blue)" },
    { href: "/today", label: "今日汇总", desc: "按类型分组查看", icon: "calendar", color: "var(--accent-green)" },
    { href: "/ai", label: "AI 生成日报", desc: "选择模型一键生成", icon: "sparkles", color: "var(--accent-purple)" },
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
          <Link href="/notes/new" className="btn btn-primary">+ 新增记录</Link>
          <Link href="/ai" className="btn btn-purple">AI 助手</Link>
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

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href} className="card card-hover" style={{ padding: 20, textDecoration: "none" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: a.color, color: "white", marginBottom: 12, fontSize: 18,
            }}>
              {a.icon === "plus" ? "+" : a.icon === "calendar" ? "D" : "AI"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{a.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{a.desc}</div>
          </Link>
        ))}
      </div>

      {/* Recent Notes */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>最近记录</h2>
          <Link href="/notes" style={{ fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}>
            查看全部 →
          </Link>
        </div>
        {recentNotes.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">📝</div>
            暂无记录，点击「新增记录」开始
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {recentNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
