import { prisma } from "@/lib/prisma";
import { TYPE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [total, byType, byStatus, byPriority, byProject, openCount, followingCount] =
    await Promise.all([
      prisma.note.count(),
      prisma.note.groupBy({ by: ["type"], _count: true }),
      prisma.note.groupBy({ by: ["status"], _count: true }),
      prisma.note.groupBy({ by: ["priority"], _count: true }),
      prisma.note.groupBy({ by: ["project"], _count: true }),
      prisma.note.count({ where: { status: "open" } }),
      prisma.note.count({ where: { status: "following" } }),
    ]);

  const StatTable = ({ title, data, labelMap }: {
    title: string;
    data: Record<string, unknown>[];
    labelMap?: Record<string, string>;
  }) => (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="section-header">{title}</div>
      <div>
        {data.map((item, idx) => {
          const key = Object.keys(item).find((k) => k !== "_count")!;
          const value = item[key] as string;
          const count = typeof item._count === "number" ? item._count : (item._count as Record<string, number>)?._all ?? 0;
          const label = labelMap?.[value] || value || "(未设置)";
          const pct = total > 0 ? Math.round((count as number / total) * 100) : 0;
          return (
            <div key={String(value) + idx} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderBottom: "1px solid var(--border-primary)",
              fontSize: 13,
            }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--bg-tertiary)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "var(--accent-blue)", transition: "width 0.3s" }} />
                </div>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", minWidth: 30, textAlign: "right" }}>{count as number}</span>
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>暂无数据</div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>数据统计</h1>

      {/* Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">总记录数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-blue)" }}>{openCount}</div>
          <div className="stat-label">待处理</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-orange)" }}>{followingCount}</div>
          <div className="stat-label">跟进中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-green)" }}>{total - openCount - followingCount}</div>
          <div className="stat-label">已关闭</div>
        </div>
      </div>

      {/* Detail Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
        <StatTable title="按类型统计" data={byType} labelMap={TYPE_LABELS} />
        <StatTable title="按状态统计" data={byStatus} labelMap={STATUS_LABELS} />
        <StatTable title="按优先级统计" data={byPriority} labelMap={PRIORITY_LABELS} />
        <StatTable
          title="按项目/版本统计"
          data={byProject.map((p) => ({ ...p, project: p.project || "(未设置)" }))}
        />
      </div>
    </div>
  );
}
