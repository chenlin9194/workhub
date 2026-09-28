"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { buildItemsLink, buildLogsLink } from "@/lib/filterLinks";
import { getLocalDateString } from "@/lib/utils";

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

type Metric = {
  label: string;
  value: string | number;
  meta: string;
  icon: string;
  tone: string;
  href?: string;
};

function MetricCard({ metric }: { metric: Metric }) {
  const content = (
    <>
      <div className="stat-topline">
        <span className="stat-icon">
          <Icon name={metric.icon} size={15} />
        </span>
        <span className="stat-meta">{metric.meta}</span>
      </div>
      <strong className="stat-value">{metric.value}</strong>
      <span className="stat-label">{metric.label}</span>
    </>
  );

  if (metric.href) {
    return (
      <Link href={metric.href} className={`stat-card metric-${metric.tone} stats-kpi-link`}>
        {content}
      </Link>
    );
  }

  return <div className={`stat-card metric-${metric.tone} stats-kpi-static`}>{content}</div>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("stats request failed");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="panel-loading"><span className="nav-loading-dot" />正在读取交付状态...</div>;
  if (!stats) {
    return (
      <div className="card empty-state empty-state--error compact-list-empty">
        <div className="empty-icon">!</div>
        <strong>统计数据暂时加载失败</strong>
        <p>可以稍后重试，或回到工作台查看事项和日志的基础状态。</p>
        <div className="empty-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void fetchStats()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  const today = getLocalDateString();
  const itemTotal = Math.max(stats.items.total, 1);
  const completionRate = Math.round((stats.items.closed / itemTotal) * 100);
  const activeItems = stats.items.open + stats.items.following + stats.items.blocked;
  const highPriorityCount = stats.items.p0 + stats.items.p1;
  const todayLogContribution = stats.logs.total > 0 ? Math.round((stats.logs.today / stats.logs.total) * 100) : 0;

  const situationMetrics: Metric[] = [
    { label: "闭环率", value: `${completionRate}%`, meta: "已闭环", icon: "check-circle", tone: "neutral" },
    { label: "活跃事项", value: activeItems, meta: "进行中", icon: "activity", tone: activeItems > 0 ? "blue" : "neutral", href: buildItemsLink({ visibility: "open" }) },
    { label: "P0/P1", value: highPriorityCount, meta: "高优事项", icon: "zap", tone: highPriorityCount > 0 ? "warning" : "neutral", href: buildItemsLink({ visibility: "open", priority: "P0,P1" }) },
    { label: "逾期", value: stats.items.overdue, meta: "逾期事项", icon: "clock", tone: stats.items.overdue > 0 ? "danger" : "neutral", href: buildItemsLink({ visibility: "open", overdue: true }) },
    { label: "今日日志", value: stats.logs.today, meta: "日志", icon: "file-text", tone: "slate", href: buildLogsLink({ startDate: today, endDate: today, view: "" }) },
  ];

  const riskSignals = [
    { label: "P0 紧急", value: stats.items.p0, note: stats.items.p0 > 0 ? "需要立即处理" : "当前无紧急项", icon: "zap", tone: stats.items.p0 > 0 ? "danger" : "neutral", href: buildItemsLink({ visibility: "open", priority: "P0" }) },
    { label: "P1 高优", value: stats.items.p1, note: stats.items.p1 > 0 ? "需要持续跟进" : "当前无高优项", icon: "alert-triangle", tone: stats.items.p1 > 0 ? "warning" : "neutral", href: buildItemsLink({ visibility: "open", priority: "P1" }) },
    { label: "阻塞", value: stats.items.blocked, note: stats.items.blocked > 0 ? "需要解除依赖" : "当前无阻塞", icon: "shield-off", tone: stats.items.blocked > 0 ? "danger" : "neutral", href: buildItemsLink({ visibility: "open", status: "blocked" }) },
    { label: "逾期", value: stats.items.overdue, note: stats.items.overdue > 0 ? "需要推进闭环" : "当前节奏正常", icon: "clock", tone: stats.items.overdue > 0 ? "warning" : "neutral", href: buildItemsLink({ visibility: "open", overdue: true }) },
  ];

  const itemDistribution = [
    { label: "待处理", value: stats.items.open, tone: "blue" },
    { label: "跟进中", value: stats.items.following, tone: "cyan" },
    { label: "已阻塞", value: stats.items.blocked, tone: "danger" },
    { label: "已关闭", value: stats.items.closed, tone: "success" },
  ];

  return (
    <div className="page-shell auxiliary-page stats-page stats-cockpit-page delivery-health-page">
      <header className="command-page-header">
        <div>
          <h1>统计概览</h1>
          <p>用于观察交付健康水位、风险分布和日志活跃度。这里辅助判断状态，不直接生成管理结论。</p>
        </div>
        <span className="monitor-status"><i />观察中</span>
      </header>

      <section className="card cockpit-card stats-situation-card">
        <div className="cockpit-card-head">
          <div>
            <h2>整体健康水位</h2>
          </div>
          <span className="section-count">指标可辅助判断，不自动输出结论</span>
        </div>
        <div className="cockpit-metrics stats-situation-grid">
          {situationMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-heading">
          <div><h2>交付健康度</h2></div>
        </div>
        <div className="health-layout">
          <div className="card completion-card">
            <div className="completion-ring" style={{ "--progress": `${completionRate * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{completionRate}%</strong><small>闭环率</small></div>
            </div>
            <div className="completion-copy">
              <span>事项闭环</span>
              <strong>{stats.items.closed} / {stats.items.total} 已关闭</strong>
              <p>当前仍有 {activeItems} 个事项需要持续跟进。闭环率没有固定阈值，因此保持中性表达。</p>
            </div>
          </div>
          <div className="health-signal-grid risk-signal-grid">
            {riskSignals.map((signal) => (
              <Link key={signal.label} href={signal.href} className={`card health-signal signal-${signal.tone}`}>
                <span className="health-signal-icon"><Icon name={signal.icon} size={17} /></span>
                <div><small>{signal.label}</small><strong>{signal.value}</strong><p>{signal.note}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-heading">
          <div><h2>事项分布</h2></div>
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
              <Link href={buildItemsLink({ visibility: "open", priority: "P0" })} className="priority-readout critical"><small>P0 · 紧急</small><strong>{stats.items.p0}</strong></Link>
              <Link href={buildItemsLink({ visibility: "open", priority: "P1" })} className="priority-readout high"><small>P1 · 高</small><strong>{stats.items.p1}</strong></Link>
            </div>
            <div className="priority-note"><span>未关闭高优事项</span><strong>{highPriorityCount}</strong></div>
          </div>
        </div>
      </section>

      <section className="monitor-section">
        <div className="monitor-section-heading">
          <div><h2>日志活跃</h2></div>
        </div>
        <div className="card log-activity-panel">
          <Link href={buildLogsLink({ startDate: today, endDate: today, view: "" })} className="log-activity-primary">
            <span className="health-signal-icon"><Icon name="activity" size={19} /></span>
            <div><small>今日记录</small><strong>{stats.logs.today}</strong><p>条今日日志</p></div>
          </Link>
          <div className="log-activity-divider" />
          <div className="log-activity-total"><small>累计事实记录</small><strong>{stats.logs.total}</strong></div>
          <div className="log-activity-track">
            <div><span>今日记录贡献</span><strong>{todayLogContribution}%</strong></div>
            <div className="progress-track"><i style={{ width: `${Math.min(100, todayLogContribution)}%` }} /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
