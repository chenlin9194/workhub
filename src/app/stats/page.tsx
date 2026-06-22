"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";

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
  logs: { total: number; today: number };
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

  if (loading) return <div className="panel-loading"><span className="nav-loading-dot" />正在读取交付状态...</div>;
  if (!stats) return <div className="panel-loading">统计数据加载失败</div>;

  const itemTotal = Math.max(stats.items.total, 1);
  const completionRate = Math.round((stats.items.closed / itemTotal) * 100);
  const activeItems = stats.items.open + stats.items.following + stats.items.blocked;
  const itemDistribution = [
    { label: "待处理", value: stats.items.open, tone: "blue" },
    { label: "跟进中", value: stats.items.following, tone: "cyan" },
    { label: "已阻塞", value: stats.items.blocked, tone: "danger" },
    { label: "已关闭", value: stats.items.closed, tone: "success" },
  ];

  const healthSignals = [
    { label: "P0 紧急", value: stats.items.p0, note: stats.items.p0 > 0 ? "需要立即处理" : "当前无紧急项", icon: "zap", tone: stats.items.p0 > 0 ? "danger" : "success" },
    { label: "逾期事项", value: stats.items.overdue, note: stats.items.overdue > 0 ? "需要推进闭环" : "交付节奏正常", icon: "clock", tone: stats.items.overdue > 0 ? "warning" : "success" },
    { label: "阻塞事项", value: stats.items.blocked, note: stats.items.blocked > 0 ? "需要解除依赖" : "当前无阻塞", icon: "shield-off", tone: stats.items.blocked > 0 ? "danger" : "success" },
    { label: "今日到期", value: stats.items.todayDue, note: "关注今日交付窗口", icon: "calendar", tone: "purple" },
  ];

  return (
    <div className="stats-page">
      <header className="command-page-header">
        <div>
          <span className="section-eyebrow">DELIVERY HEALTH MONITOR</span>
          <h1>交付健康监控</h1>
          <p>用事项风险、闭环状态与日志活跃度观察当前交付节奏。</p>
        </div>
        <span className="monitor-status"><i />MONITORING</span>
      </header>

      <section className="monitor-section">
        <div className="monitor-section-heading">
          <div><span>01</span><h2>交付健康度</h2></div>
          <small>DELIVERY HEALTH</small>
        </div>
        <div className="health-layout">
          <div className="card completion-card">
            <div className="completion-ring" style={{ "--progress": `${completionRate * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{completionRate}%</strong><small>闭环率</small></div>
            </div>
            <div className="completion-copy">
              <span>Overall Delivery</span>
              <strong>{stats.items.closed} / {stats.items.total} 已关闭</strong>
              <p>当前仍有 {activeItems} 个活跃事项需要持续推进。</p>
            </div>
          </div>
          <div className="health-signal-grid">
            {healthSignals.map((signal) => (
              <div key={signal.label} className={`card health-signal signal-${signal.tone}`}>
                <span className="health-signal-icon"><Icon name={signal.icon} size={17} /></span>
                <div><small>{signal.label}</small><strong>{signal.value}</strong><p>{signal.note}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-heading">
          <div><span>02</span><h2>事项分布</h2></div>
          <small>WORK ITEM DISTRIBUTION</small>
        </div>
        <div className="stats-two-column">
          <div className="card distribution-panel">
            <div className="distribution-total"><span>全部事项</span><strong>{stats.items.total}</strong></div>
            <div className="distribution-bars">
              {itemDistribution.map((item) => {
                const percent = Math.round((item.value / itemTotal) * 100);
                return (
                  <div key={item.label} className={`distribution-row distribution-${item.tone}`}>
                    <div><span>{item.label}</span><strong>{item.value}</strong></div>
                    <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
                    <small>{percent}%</small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card priority-monitor">
            <div className="priority-monitor-heading"><Icon name="alert-triangle" size={17} /><span>优先级雷达</span></div>
            <div className="priority-monitor-grid">
              <div className="priority-readout critical"><small>P0 / CRITICAL</small><strong>{stats.items.p0}</strong></div>
              <div className="priority-readout high"><small>P1 / HIGH</small><strong>{stats.items.p1}</strong></div>
            </div>
            <div className="priority-note"><span>未关闭高优事项</span><strong>{stats.items.p0 + stats.items.p1}</strong></div>
          </div>
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-heading">
          <div><span>03</span><h2>日志活跃度</h2></div>
          <small>LOG ACTIVITY</small>
        </div>
        <div className="card log-activity-panel">
          <div className="log-activity-primary"><span className="health-signal-icon"><Icon name="activity" size={19} /></span><div><small>TODAY CAPTURED</small><strong>{stats.logs.today}</strong><p>条今日日志</p></div></div>
          <div className="log-activity-divider" />
          <div className="log-activity-total"><small>累计事实记录</small><strong>{stats.logs.total}</strong></div>
          <div className="log-activity-track"><div><span>今日记录贡献</span><strong>{stats.logs.total > 0 ? Math.round((stats.logs.today / stats.logs.total) * 100) : 0}%</strong></div><div className="progress-track"><i style={{ width: `${stats.logs.total > 0 ? Math.min(100, Math.round((stats.logs.today / stats.logs.total) * 100)) : 0}%` }} /></div></div>
        </div>
      </section>
    </div>
  );
}
