"use client";

import { useState } from "react";
import { HEALTH_LABELS, PRIORITY_LABELS, STATUS_LABELS, WORK_LOG_TYPE_LABELS } from "@/lib/constants";
import { signalToItemsHref, signalToLogsHref } from "@/lib/signalMap";
import type { WorkItem, WorkLog } from "@/lib/types";

type FocusKey = "attention" | "logs" | "p0p1" | "blocked" | "overdue" | "risk";
type SignalTone = "neutral" | "danger" | "warning" | "success";

type ProjectSignalSectionProps = {
  projectId: string;
  items: WorkItem[];
  logs: WorkLog[];
  today: string;
  itemCount: number;
  logCount: number;
  p0p1Count: number;
  blockedCount: number;
  redYellowCount: number;
  overdueCount: number;
};

const SIGNAL_TONE_STYLE: Record<SignalTone, { color: string; background: string; border: string }> = {
  neutral: {
    color: "var(--text-secondary)",
    background: "var(--bg-secondary)",
    border: "var(--border-secondary)",
  },
  danger: {
    color: "var(--accent-red)",
    background: "var(--accent-red-light)",
    border: "color-mix(in srgb, var(--accent-red) 24%, var(--border-primary))",
  },
  warning: {
    color: "var(--accent-orange)",
    background: "var(--accent-orange-light)",
    border: "color-mix(in srgb, var(--accent-orange) 24%, var(--border-primary))",
  },
  success: {
    color: "var(--accent-green)",
    background: "var(--accent-green-light)",
    border: "color-mix(in srgb, var(--accent-green) 22%, var(--border-primary))",
  },
};

const FOCUS_LABELS: Record<FocusKey, string> = {
  attention: "关键事项",
  logs: "最近日志",
  p0p1: "P0/P1",
  blocked: "阻塞",
  overdue: "逾期",
  risk: "红黄风险",
};

function isOpenItem(item: WorkItem) {
  return item.status !== "closed";
}

function isItemOverdue(item: WorkItem, today: string) {
  return Boolean(item.dueDate && item.dueDate < today && isOpenItem(item));
}

function getItemRank(item: WorkItem, today: string) {
  if (!isOpenItem(item)) return 8;
  if (item.status === "blocked") return 0;
  if (isItemOverdue(item, today)) return 1;
  if (item.priority === "P0") return 2;
  if (item.priority === "P1") return 3;
  if (item.health === "red") return 4;
  if (item.health === "yellow") return 5;
  return 6;
}

function toTime(value?: Date | string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortItems(items: WorkItem[], today: string) {
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };

  return [...items].sort((a, b) => {
    const rankDiff = getItemRank(a, today) - getItemRank(b, today);
    if (rankDiff !== 0) return rankDiff;

    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return toTime(b.updatedAt) - toTime(a.updatedAt);
  });
}

function sortLogs(logs: WorkLog[]) {
  return [...logs].sort((a, b) => {
    const workDateDiff = b.workDate.localeCompare(a.workDate);
    if (workDateDiff !== 0) return workDateDiff;

    return toTime(b.createdAt) - toTime(a.createdAt);
  });
}

function getFocusItems(focus: FocusKey, items: WorkItem[], today: string) {
  const openItems = items.filter(isOpenItem);

  if (focus === "p0p1") return sortItems(openItems.filter((item) => item.priority === "P0" || item.priority === "P1"), today);
  if (focus === "blocked") return sortItems(openItems.filter((item) => item.status === "blocked"), today);
  if (focus === "overdue") return sortItems(openItems.filter((item) => isItemOverdue(item, today)), today);
  if (focus === "risk") return sortItems(openItems.filter((item) => item.health === "red" || item.health === "yellow"), today);
  return sortItems(openItems.filter((item) => getItemRank(item, today) <= 5), today);
}

function SignalMetric({
  value,
  label,
  tone = "neutral",
  active,
  onClick,
}: {
  value: number;
  label: string;
  tone?: SignalTone;
  active: boolean;
  onClick: () => void;
}) {
  const resolvedTone = value > 0 ? tone : "neutral";
  const toneStyle = SIGNAL_TONE_STYLE[resolvedTone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        minHeight: 32,
        padding: "5px 10px",
        borderRadius: 8,
        border: `1px solid ${active ? toneStyle.color : toneStyle.border}`,
        background: active ? "var(--bg-primary)" : toneStyle.background,
        color: value > 0 ? toneStyle.color : "var(--text-tertiary)",
        whiteSpace: "nowrap",
        cursor: "pointer",
        boxShadow: active ? `0 0 0 1px ${toneStyle.border}` : "none",
      }}
    >
      <strong style={{ fontSize: 16, lineHeight: 1 }}>{value}</strong>
      <span style={{ fontSize: 12, fontWeight: value > 0 || active ? 650 : 500 }}>{label}</span>
    </button>
  );
}

function FocusItemRow({ item }: { item: WorkItem }) {
  const summary = item.currentSummary || item.nextAction || item.trackingReason || item.nextCheckpoint || item.description || "—";

  return (
    <div style={{ display: "grid", gap: 3, padding: "7px 0", borderTop: "1px solid var(--border-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "min(520px, 100%)" }}>{item.title}</strong>
        <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{PRIORITY_LABELS[item.priority] || item.priority}</span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{STATUS_LABELS[item.status] || item.status}</span>
        <span style={{ color: item.health === "red" ? "var(--accent-red)" : item.health === "yellow" ? "var(--accent-orange)" : "var(--text-tertiary)", fontSize: 12 }}>{HEALTH_LABELS[item.health] || item.health}</span>
        {item.owner && <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{item.owner}</span>}
      </div>
      <div style={{ color: summary === "—" ? "var(--text-tertiary)" : "var(--text-secondary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {summary}
      </div>
    </div>
  );
}

function FocusLogRow({ log }: { log: WorkLog }) {
  return (
    <div style={{ display: "grid", gap: 3, padding: "7px 0", borderTop: "1px solid var(--border-secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "min(520px, 100%)" }}>{log.title}</strong>
        <span style={{ color: log.type === "risk" ? "var(--accent-red)" : log.type === "blocker" ? "var(--accent-orange)" : "var(--text-tertiary)", fontSize: 12 }}>{WORK_LOG_TYPE_LABELS[log.type] || log.type}</span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{log.workDate}</span>
      </div>
      <div style={{ color: log.content ? "var(--text-secondary)" : "var(--text-tertiary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {log.content || "—"}
      </div>
    </div>
  );
}

export default function ProjectSignalSection({
  projectId,
  items,
  logs,
  today,
  itemCount,
  logCount,
  p0p1Count,
  blockedCount,
  redYellowCount,
  overdueCount,
}: ProjectSignalSectionProps) {
  const [focus, setFocus] = useState<FocusKey>("attention");
  const hasHardSignal = p0p1Count + blockedCount + overdueCount > 0;
  const hasRiskSignal = redYellowCount > 0;
  const signalTitle = hasHardSignal ? "需关注" : hasRiskSignal ? "存在风险关注" : "暂无需优先处理信号";
  const signalHint = hasHardSignal
    ? `P0/P1 ${p0p1Count} · 阻塞 ${blockedCount} · 逾期 ${overdueCount} · 红黄风险 ${redYellowCount}`
    : hasRiskSignal
      ? `红黄风险 ${redYellowCount}，建议结合本页事项和日志继续确认。`
      : "当前项目没有高优先级异常。";

  const focusItems = focus === "logs" ? [] : getFocusItems(focus, items, today).slice(0, 5);
  const focusLogs = focus === "logs" ? sortLogs(logs).slice(0, 5) : [];
  const focusIsLogs = focus === "logs";
  const focusEmptyText = focusIsLogs ? "当前没有最近日志" : `当前没有${FOCUS_LABELS[focus]}事项`;
  const viewAllHref = (() => {
    if (focusIsLogs) return signalToLogsHref("projectLogs", projectId);
    if (focus === "attention") return signalToItemsHref("projectItems", projectId);
    if (focus === "risk") return signalToItemsHref("redYellow", projectId);
    return signalToItemsHref(focus, projectId);
  })();

  return (
    <section className="cockpit-section">
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">SIGNALS</span>
          <h2>状态信号</h2>
        </div>
      </div>

      <div className="card entity-card entity-card--compact" style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <strong style={{ color: hasHardSignal ? "var(--accent-red)" : hasRiskSignal ? "var(--accent-orange)" : "var(--text-primary)", fontSize: 14 }}>
              {signalTitle}
            </strong>
            <span style={{ color: "var(--text-tertiary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {signalHint}
            </span>
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 12, whiteSpace: "nowrap" }}>事项 {itemCount} · 日志 {logCount}</div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <SignalMetric value={p0p1Count} label="P0/P1" tone={p0p1Count > 0 ? "danger" : "success"} active={focus === "p0p1"} onClick={() => setFocus("p0p1")} />
          <SignalMetric value={blockedCount} label="阻塞" tone={blockedCount > 0 ? "danger" : "success"} active={focus === "blocked"} onClick={() => setFocus("blocked")} />
          <SignalMetric value={overdueCount} label="逾期" tone={overdueCount > 0 ? "danger" : "success"} active={focus === "overdue"} onClick={() => setFocus("overdue")} />
          <SignalMetric value={redYellowCount} label="红黄风险" tone={redYellowCount > 0 ? "warning" : "success"} active={focus === "risk"} onClick={() => setFocus("risk")} />
          <SignalMetric value={itemCount} label="事项" active={focus === "attention"} onClick={() => setFocus("attention")} />
          <SignalMetric value={logCount} label="日志" active={focus === "logs"} onClick={() => setFocus("logs")} />
        </div>

        <div style={{ display: "grid", gap: 2, padding: "8px 10px 4px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-secondary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ color: "var(--text-primary)", fontSize: 13 }}>聚焦：{FOCUS_LABELS[focus]}</strong>
            <a href={viewAllHref} style={{ color: "var(--text-tertiary)", fontSize: 12, textDecoration: "none" }}>查看全部</a>
          </div>

          {focusIsLogs ? (
            focusLogs.length > 0 ? focusLogs.map((log) => <FocusLogRow key={log.id} log={log} />) : <div style={{ color: "var(--text-tertiary)", fontSize: 12, padding: "8px 0" }}>{focusEmptyText}</div>
          ) : (
            focusItems.length > 0 ? focusItems.map((item) => <FocusItemRow key={item.id} item={item} />) : <div style={{ color: "var(--text-tertiary)", fontSize: 12, padding: "8px 0" }}>{focusEmptyText}</div>
          )}
        </div>
      </div>
    </section>
  );
}
