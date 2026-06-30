"use client";

type ProjectSignalSectionProps = {
  itemCount: number;
  logCount: number;
  p0p1Count: number;
  blockedCount: number;
  redYellowCount: number;
  overdueCount: number;
};

function SignalCard({ value, label, valueColor }: { value: number; label: string; valueColor?: string }) {
  return (
    <div className="card" style={{ padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: valueColor || "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</div>
    </div>
  );
}

export default function ProjectSignalSection({
  itemCount,
  logCount,
  p0p1Count,
  blockedCount,
  redYellowCount,
  overdueCount,
}: ProjectSignalSectionProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">SIGNALS</span>
          <h2>项目信号</h2>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <SignalCard value={itemCount} label="关联事项" />
        <SignalCard value={logCount} label="关联日志" />
        <SignalCard value={p0p1Count} label="P0 / P1" valueColor="var(--critical, #ef4444)" />
        <SignalCard value={blockedCount} label="阻塞" valueColor="var(--danger, #f97316)" />
        <SignalCard value={redYellowCount} label="红黄" valueColor="var(--warning, #eab308)" />
        <SignalCard value={overdueCount} label="逾期" valueColor="var(--danger, #f97316)" />
      </div>
    </section>
  );
}
