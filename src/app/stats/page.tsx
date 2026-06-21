"use client";

import { useState, useEffect } from "react";

interface Stats {
  items: {
    total: number;
    open: number;
    following: number;
    blocked: number;
    closed: number;
    p0: number;
    p1: number;
    overdue: number;
    todayDue: number;
  };
  logs: {
    total: number;
    today: number;
  };
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>;
  }

  if (!stats) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载失败</div>;
  }

  const itemStats = [
    { label: "总事项", value: stats.items.total, color: "var(--text-primary)" },
    { label: "待处理", value: stats.items.open, color: "var(--accent-blue)" },
    { label: "跟进中", value: stats.items.following, color: "var(--accent-green)" },
    { label: "已阻塞", value: stats.items.blocked, color: "var(--accent-orange)" },
    { label: "已关闭", value: stats.items.closed, color: "var(--text-tertiary)" },
    { label: "P0 紧急", value: stats.items.p0, color: "#dc2626" },
    { label: "P1 高优", value: stats.items.p1, color: "var(--accent-red)" },
    { label: "逾期", value: stats.items.overdue, color: "var(--accent-red)" },
    { label: "今日到期", value: stats.items.todayDue, color: "var(--accent-purple)" },
  ];

  const logStats = [
    { label: "总日志", value: stats.logs.total, color: "var(--text-primary)" },
    { label: "今日日志", value: stats.logs.today, color: "var(--accent-blue)" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>统计数据</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Work Items Stats */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="section-header">
            <span>工作事项统计</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
              {itemStats.map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.value > 0 ? s.color : "var(--text-tertiary)", marginBottom: 4 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Work Logs Stats */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="section-header">
            <span>工作日志统计</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {logStats.map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.value > 0 ? s.color : "var(--text-tertiary)", marginBottom: 4 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Health Indicators */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="section-header">
            <span>健康指标</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
              <div style={{ padding: 16, background: stats.items.p0 > 0 ? "var(--accent-red)" : "var(--accent-green)", borderRadius: 8, color: "white" }}>
                <div style={{ fontSize: 14, marginBottom: 4 }}>P0 紧急事项</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.items.p0}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{stats.items.p0 > 0 ? "需要立即处理" : "状态良好"}</div>
              </div>
              <div style={{ padding: 16, background: stats.items.overdue > 0 ? "var(--accent-orange)" : "var(--accent-green)", borderRadius: 8, color: "white" }}>
                <div style={{ fontSize: 14, marginBottom: 4 }}>逾期事项</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.items.overdue}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{stats.items.overdue > 0 ? "需要跟进" : "状态良好"}</div>
              </div>
              <div style={{ padding: 16, background: "var(--accent-blue)", borderRadius: 8, color: "white" }}>
                <div style={{ fontSize: 14, marginBottom: 4 }}>今日日志</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.logs.today}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>今日已记录</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
