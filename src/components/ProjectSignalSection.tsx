"use client";

import Link from "next/link";
import { signalToItemsHref, signalToLogsHref } from "@/lib/signalMap";

type ProjectSignalSectionProps = {
  projectId: string;
  itemCount: number;
  logCount: number;
  p0p1Count: number;
  blockedCount: number;
  redYellowCount: number;
  overdueCount: number;
};

type SignalTone = "neutral" | "danger" | "warning" | "success";

const SIGNAL_TONE_STYLE: Record<SignalTone, { border: string; background: string; color: string }> = {
  neutral: {
    border: "1px solid var(--border-primary)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  danger: {
    border: "1px solid color-mix(in srgb, var(--accent-red) 28%, var(--border-primary))",
    background: "var(--accent-red-light)",
    color: "var(--accent-red)",
  },
  warning: {
    border: "1px solid color-mix(in srgb, var(--accent-orange) 28%, var(--border-primary))",
    background: "var(--accent-orange-light)",
    color: "var(--accent-orange)",
  },
  success: {
    border: "1px solid color-mix(in srgb, var(--accent-green) 24%, var(--border-primary))",
    background: "var(--accent-green-light)",
    color: "var(--accent-green)",
  },
};

function SignalCard({
  value,
  label,
  hint,
  tone = "neutral",
  href,
}: {
  value: number;
  label: string;
  hint?: string;
  tone?: SignalTone;
  href?: string;
}) {
  const toneStyle = SIGNAL_TONE_STYLE[tone];

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: value > 0 ? toneStyle.color : "var(--text-primary)" }}>{value}</div>
      </div>
      {hint && <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{hint}</div>}
    </>
  );

  if (href) {
    return (
      <Link
        className="card"
        href={href}
        style={{
          display: "block",
          padding: 16,
          border: toneStyle.border,
          background: toneStyle.background,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="card" style={{ padding: 16, border: toneStyle.border, background: toneStyle.background }}>
      {content}
    </div>
  );
}

export default function ProjectSignalSection({
  projectId,
  itemCount,
  logCount,
  p0p1Count,
  blockedCount,
  redYellowCount,
  overdueCount,
}: ProjectSignalSectionProps) {
  const mustHandleCount = p0p1Count + blockedCount + overdueCount;
  const hasHardSignal = mustHandleCount > 0;
  const hasRiskSignal = redYellowCount > 0;
  const signalTitle = hasHardSignal ? "存在需要优先处理的信号" : hasRiskSignal ? "存在需要关注的风险信号" : "暂无高优先级风险信号";
  const signalHint = hasHardSignal
    ? `P0/P1 ${p0p1Count} · 阻塞 ${blockedCount} · 逾期 ${overdueCount}`
    : hasRiskSignal
      ? `红黄状态事项 ${redYellowCount}，建议结合关联事项确认影响。`
      : "当前没有 P0/P1、阻塞或逾期事项。";

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">SIGNALS</span>
          <h2>状态信号</h2>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          border: hasHardSignal
            ? "1px solid color-mix(in srgb, var(--accent-red) 28%, var(--border-primary))"
            : hasRiskSignal
              ? "1px solid color-mix(in srgb, var(--accent-orange) 28%, var(--border-primary))"
              : "1px solid color-mix(in srgb, var(--accent-green) 22%, var(--border-primary))",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            {signalTitle}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, wordBreak: "break-word" }}>
            {signalHint}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
          事项 {itemCount} · 日志 {logCount}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <SignalCard
          value={p0p1Count}
          label="P0 / P1"
          hint="高优先级未关闭"
          tone={p0p1Count > 0 ? "danger" : "success"}
          href={signalToItemsHref("p0p1", projectId)}
        />
        <SignalCard
          value={blockedCount}
          label="阻塞"
          hint="推进受阻事项"
          tone={blockedCount > 0 ? "danger" : "success"}
          href={signalToItemsHref("blocked", projectId)}
        />
        <SignalCard
          value={overdueCount}
          label="逾期"
          hint="超过截止日期"
          tone={overdueCount > 0 ? "danger" : "success"}
          href={signalToItemsHref("overdue", projectId)}
        />
        <SignalCard value={redYellowCount} label="红黄" hint="风险或关注状态" tone={redYellowCount > 0 ? "warning" : "success"} />
        <SignalCard value={itemCount} label="事项总数" hint="状态判断来源" />
        <SignalCard value={logCount} label="日志总数" hint="事实支撑记录" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Link
          href={signalToLogsHref("risk", projectId)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--accent-red-light)",
            color: "var(--accent-red)",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Risk Logs
        </Link>
        <Link
          href={signalToLogsHref("blocker", projectId)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Blocked Logs
        </Link>
      </div>
    </section>
  );
}
