"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Icon from "@/components/Icon";
import {
  PROJECT_MILESTONE_STATUSES,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_PLAN_TYPES,
  PROJECT_PLAN_TYPE_LABELS,
} from "@/lib/constants";
import { formatDate, getLocalDateString } from "@/lib/utils";
import type { ProjectMilestone } from "@/lib/types";

type MilestoneFormState = {
  title: string;
  description: string;
  status: string;
  planType: string;
  targetDate: string;
  actualDate: string;
  owner: string;
  sourceUrl: string;
  sortOrder: string;
};

type ViewMode = "list" | "timeline";
type Tone = "done" | "active" | "next" | "risk" | "muted";

type StageGroup = {
  key: string;
  label: string;
  milestones: ProjectMilestone[];
};

type MilestoneSignal = {
  statusLabel: string;
  deviationLabel: string;
  tone: Tone;
  plannedDate: string;
  actualDate: string;
  daysLeft?: number;
  isNext: boolean;
  isNear: boolean;
  isDone: boolean;
  isRisk: boolean;
  showDeviation: boolean;
};

const EMPTY_MILESTONE_FORM: MilestoneFormState = {
  title: "",
  description: "",
  status: "planned",
  planType: "milestone",
  targetDate: "",
  actualDate: "",
  owner: "",
  sourceUrl: "",
  sortOrder: "0",
};

const CLOSED_MILESTONE_STATUSES = new Set(["done", "cancelled"]);

const STAGE_ORDER = ["planning", "concept", "plan", "verification", "other"];
const STAGE_LABELS: Record<string, string> = {
  planning: "规划阶段",
  concept: "概念阶段",
  plan: "计划阶段",
  verification: "开发验证阶段",
  other: "其他",
};

const INPUT_STYLE = {
  width: "100%",
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
};

const TABLE_CELL_STYLE = {
  padding: "9px 10px",
  borderBottom: "1px solid var(--border-secondary)",
  verticalAlign: "middle" as const,
};

const TABLE_HEAD_CELL_STYLE = {
  padding: "9px 10px",
  borderBottom: "1px solid var(--border-primary)",
  color: "var(--text-tertiary)",
  fontSize: 12,
  fontWeight: 600,
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

const VIEW_BUTTON_STYLE = {
  height: 36,
  minHeight: 36,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const TONE_STYLE: Record<Tone, { color: string; background: string; border: string }> = {
  done: {
    color: "var(--accent-green)",
    background: "var(--accent-green-light)",
    border: "color-mix(in srgb, var(--accent-green) 28%, transparent)",
  },
  active: {
    color: "var(--accent-blue)",
    background: "var(--accent-blue-light)",
    border: "color-mix(in srgb, var(--accent-blue) 28%, transparent)",
  },
  next: {
    color: "var(--accent-blue)",
    background: "color-mix(in srgb, var(--accent-blue-light) 72%, var(--bg-primary))",
    border: "var(--accent-blue)",
  },
  risk: {
    color: "var(--accent-red)",
    background: "var(--accent-red-light)",
    border: "color-mix(in srgb, var(--accent-red) 30%, transparent)",
  },
  muted: {
    color: "var(--text-secondary)",
    background: "var(--bg-secondary)",
    border: "var(--border-primary)",
  },
};

type ProjectMilestoneSectionProps = {
  projectId: string;
};

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  return formatDate(value, "iso");
}

function getDateKey(value?: string | Date | null) {
  if (!value) return "";
  return formatDate(value, "iso");
}

function toUtcTime(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function diffDays(from: string, to: string) {
  return Math.round((toUtcTime(to) - toUtcTime(from)) / 86400000);
}

function formatShortDate(value?: string | Date | null) {
  if (!value) return "";
  return formatDate(value);
}

function isMilestoneClosed(milestone: ProjectMilestone) {
  return CLOSED_MILESTONE_STATUSES.has(milestone.status);
}

function getMilestoneSearchText(milestone: ProjectMilestone) {
  return [
    milestone.title,
    PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || milestone.planType,
    PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status,
    milestone.owner,
    milestone.description,
    milestone.sourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferStageKey(milestone: ProjectMilestone) {
  const source = `${milestone.description || ""} ${milestone.title || ""}`.toLowerCase();

  if (source.includes("规划阶段") || source.includes("规划ko") || source.includes("cdcp")) return "planning";
  if (source.includes("概念阶段") || source.includes("概念启动") || source.includes("str1")) return "concept";
  if (source.includes("计划阶段") || source.includes("str2") || source.includes("str3")) return "plan";
  if (source.includes("开发验证阶段") || source.includes("kick off") || source.includes("str4") || source.includes("str5")) return "verification";
  return "other";
}

function groupMilestonesByStage(milestones: ProjectMilestone[]): StageGroup[] {
  const groups = new Map<string, ProjectMilestone[]>();

  milestones.forEach((milestone) => {
    const key = inferStageKey(milestone);
    groups.set(key, [...(groups.get(key) || []), milestone]);
  });

  return STAGE_ORDER.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    milestones: groups.get(key) || [],
  })).filter((group) => group.milestones.length > 0);
}

function sortMilestones(milestones: ProjectMilestone[]) {
  return [...milestones].sort((a, b) => {
    const aStage = STAGE_ORDER.indexOf(inferStageKey(a));
    const bStage = STAGE_ORDER.indexOf(inferStageKey(b));
    if (aStage !== bStage) return aStage - bStage;

    const aDate = getDateKey(a.targetDate);
    const bDate = getDateKey(b.targetDate);
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;

    const sortOrderDiff = a.sortOrder - b.sortOrder;
    if (sortOrderDiff !== 0) return sortOrderDiff;

    return a.title.localeCompare(b.title, "zh-CN");
  });
}

function findNextMilestone(milestones: ProjectMilestone[]) {
  const candidates = milestones.filter((milestone) => !milestone.actualDate && !isMilestoneClosed(milestone));
  if (candidates.length === 0) return null;
  return sortMilestones(candidates)[0] ?? null;
}

function getMilestoneSignal(milestone: ProjectMilestone, today: string, nextMilestoneId?: string | null): MilestoneSignal {
  const plannedDate = getDateKey(milestone.targetDate);
  const actualDate = getDateKey(milestone.actualDate);
  const isNext = Boolean(nextMilestoneId && milestone.id === nextMilestoneId);

  if (actualDate) {
    if (plannedDate) {
      const delta = diffDays(plannedDate, actualDate);
      if (delta > 0) {
        return {
          statusLabel: "已完成",
          deviationLabel: `延期 ${delta} 天`,
          tone: "risk",
          plannedDate,
          actualDate,
          isNext,
          isNear: false,
          isDone: true,
          isRisk: true,
          showDeviation: true,
        };
      }
      if (delta < 0) {
        return {
          statusLabel: "已完成",
          deviationLabel: `提前 ${Math.abs(delta)} 天`,
          tone: "done",
          plannedDate,
          actualDate,
          isNext,
          isNear: false,
          isDone: true,
          isRisk: false,
          showDeviation: true,
        };
      }
      return {
        statusLabel: "已完成",
        deviationLabel: "准时",
        tone: "done",
        plannedDate,
        actualDate,
        isNext,
        isNear: false,
        isDone: true,
        isRisk: false,
        showDeviation: true,
      };
    }

    return {
      statusLabel: "已完成",
      deviationLabel: "计划日期待补",
      tone: "done",
      plannedDate,
      actualDate,
      isNext,
      isNear: false,
      isDone: true,
      isRisk: false,
      showDeviation: true,
    };
  }

  if (plannedDate && plannedDate < today) {
    return {
      statusLabel: "逾期",
      deviationLabel: `逾期 ${diffDays(plannedDate, today)} 天`,
      tone: "risk",
      plannedDate,
      actualDate,
      isNext,
      isNear: false,
      isDone: false,
      isRisk: true,
      showDeviation: true,
    };
  }

  if (plannedDate && plannedDate >= today) {
    const daysLeft = diffDays(today, plannedDate);
    const isNear = daysLeft <= 7;
    return {
      statusLabel: isNext ? "下一节点" : PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || "计划中",
      deviationLabel: daysLeft === 0 ? "今天" : `剩余 ${daysLeft} 天`,
      tone: isNext ? "next" : isNear ? "active" : "muted",
      plannedDate,
      actualDate,
      daysLeft,
      isNext,
      isNear,
      isDone: false,
      isRisk: false,
      showDeviation: isNext || isNear,
    };
  }

  return {
    statusLabel: isNext ? "下一节点" : PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || "未开始",
    deviationLabel: "日期待定",
    tone: isNext ? "next" : "muted",
    plannedDate,
    actualDate,
    isNext,
    isNear: false,
    isDone: false,
    isRisk: false,
    showDeviation: isNext,
  };
}

function MilestoneInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={INPUT_STYLE}
    />
  );
}

function MilestoneSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={INPUT_STYLE}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatusPill({ signal }: { signal: MilestoneSignal }) {
  const tone = TONE_STYLE[signal.tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        fontSize: 11,
        fontWeight: 650,
        whiteSpace: "nowrap",
      }}
    >
      {signal.statusLabel}
    </span>
  );
}

function StatusMark({ signal }: { signal: MilestoneSignal }) {
  const tone = TONE_STYLE[signal.tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: tone.color, fontSize: 11, fontWeight: signal.isNext || signal.isRisk ? 650 : 500, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.color, opacity: signal.tone === "muted" ? 0.45 : 0.8 }} />
      {signal.statusLabel}
    </span>
  );
}

function DeviationText({ signal, fallback = "" }: { signal: MilestoneSignal; fallback?: string }) {
  if (!signal.showDeviation) {
    return fallback ? <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{fallback}</span> : null;
  }

  const tone = TONE_STYLE[signal.tone];
  return (
    <span style={{ color: tone.color, fontSize: 12, fontWeight: signal.isRisk || signal.isNext ? 650 : 500, whiteSpace: "nowrap" }}>
      {signal.deviationLabel}
    </span>
  );
}

function ActualDeviationText({ signal }: { signal: MilestoneSignal }) {
  if (!signal.actualDate) {
    return <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>—</span>;
  }

  const tone = TONE_STYLE[signal.tone];
  return (
    <span style={{ color: tone.color, fontSize: 12, fontWeight: signal.isRisk ? 650 : 500, whiteSpace: "nowrap" }}>
      {signal.deviationLabel}
    </span>
  );
}

function MilestoneFormPanel({
  form,
  setForm,
  saving,
  error,
  title,
  onSave,
  onCancel,
}: {
  form: MilestoneFormState;
  setForm: Dispatch<SetStateAction<MilestoneFormState>>;
  saving: boolean;
  error: string;
  title: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card entity-card entity-card--compact" style={{ padding: 12, marginBottom: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{title}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onSave} className="btn btn-primary" disabled={saving} style={VIEW_BUTTON_STYLE}>
            {saving ? "保存中" : "保存"}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving} style={VIEW_BUTTON_STYLE}>
            取消
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(130px, 0.8fr) minmax(122px, 0.75fr) minmax(260px, 1.35fr)", gap: 10, alignItems: "start" }}>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>名称</span>
          <MilestoneInput
            value={form.title}
            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            placeholder="节点/计划名称 *"
          />
          {error && <span style={{ color: "var(--accent-red)", fontSize: 12 }}>{error}</span>}
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>类型</span>
          <MilestoneSelect
            value={form.planType}
            onChange={(value) => setForm((prev) => ({ ...prev, planType: value }))}
            options={PROJECT_PLAN_TYPES}
          />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>状态</span>
          <MilestoneSelect
            value={form.status}
            onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
            options={PROJECT_MILESTONE_STATUSES}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(120px, 1fr)", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>计划日期</span>
            <MilestoneInput
              type="date"
              value={form.targetDate}
              onChange={(value) => setForm((prev) => ({ ...prev, targetDate: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>实际日期</span>
            <MilestoneInput
              type="date"
              value={form.actualDate}
              onChange={(value) => setForm((prev) => ({ ...prev, actualDate: value }))}
            />
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 0.7fr) minmax(220px, 1.2fr) minmax(220px, 1.2fr)", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>负责人</span>
          <MilestoneInput
            value={form.owner}
            onChange={(value) => setForm((prev) => ({ ...prev, owner: value }))}
            placeholder="负责人"
          />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>说明</span>
          <MilestoneInput
            value={form.description}
            onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
            placeholder="说明"
          />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>关联链接</span>
          <MilestoneInput
            type="url"
            value={form.sourceUrl}
            onChange={(value) => setForm((prev) => ({ ...prev, sourceUrl: value }))}
            placeholder="关联链接"
          />
        </label>
      </div>
    </div>
  );
}

function MatrixNodeHeader({
  milestone,
  signal,
  onSelect,
}: {
  milestone: ProjectMilestone;
  signal: MilestoneSignal;
  onSelect: (milestone: ProjectMilestone) => void;
}) {
  const tone = TONE_STYLE[signal.tone];

  return (
    <button
      type="button"
      onClick={() => onSelect(milestone)}
      style={{
        width: "100%",
        minHeight: 54,
        padding: "6px 8px",
        border: `1px solid ${signal.isNext ? "var(--accent-blue)" : signal.isRisk ? TONE_STYLE.risk.border : "var(--border-secondary)"}`,
        borderRadius: 8,
        background: signal.isNext ? tone.background : signal.isRisk ? "color-mix(in srgb, var(--accent-red-light) 45%, var(--bg-primary))" : "var(--bg-primary)",
        color: "var(--text-primary)",
        textAlign: "left",
        cursor: "pointer",
        display: "grid",
        gap: 4,
        boxShadow: signal.isNext ? "0 0 0 1px color-mix(in srgb, var(--accent-blue) 18%, transparent)" : "none",
      }}
      title={milestone.description || milestone.title}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{milestone.title}</strong>
        {signal.isNext && <span style={{ color: "var(--accent-blue)", fontSize: 11, fontWeight: 700, flex: "0 0 auto" }}>下一节点</span>}
      </span>
      <StatusMark signal={signal} />
    </button>
  );
}

function CompactPlanMatrix({
  groups,
  today,
  nextMilestoneId,
  onSelect,
}: {
  groups: StageGroup[];
  today: string;
  nextMilestoneId?: string | null;
  onSelect: (milestone: ProjectMilestone) => void;
}) {
  const allMilestones = groups.flatMap((group) => group.milestones);
  const minWidth = Math.max(780, allMilestones.length * 136 + 112);

  return (
    <div className="card" style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...TABLE_HEAD_CELL_STYLE, width: 112, position: "sticky", left: 0, zIndex: 3, background: "var(--bg-primary)" }}>信息项</th>
            {groups.map((group) => (
              <th
                key={group.key}
                colSpan={group.milestones.length}
                style={{
                  ...TABLE_HEAD_CELL_STYLE,
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                  borderLeft: "1px solid var(--border-secondary)",
                }}
              >
                {group.label} · {group.milestones.length} 节点
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ ...TABLE_HEAD_CELL_STYLE, width: 112, position: "sticky", left: 0, zIndex: 3, background: "var(--bg-primary)" }}>节点</th>
            {allMilestones.map((milestone) => (
              <th key={milestone.id} style={{ ...TABLE_HEAD_CELL_STYLE, width: 136, padding: 7, verticalAlign: "top" }}>
                <MatrixNodeHeader
                  milestone={milestone}
                  signal={getMilestoneSignal(milestone, today, nextMilestoneId)}
                  onSelect={onSelect}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...TABLE_CELL_STYLE, position: "sticky", left: 0, zIndex: 2, background: "var(--bg-primary)", color: "var(--text-tertiary)", fontWeight: 650 }}>计划日期</td>
            {allMilestones.map((milestone) => (
              <td key={`${milestone.id}-planned`} style={{ ...TABLE_CELL_STYLE, textAlign: "center", color: "var(--text-secondary)" }}>
                {formatShortDate(milestone.targetDate) || "-"}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ ...TABLE_CELL_STYLE, position: "sticky", left: 0, zIndex: 2, background: "var(--bg-primary)", color: "var(--text-tertiary)", fontWeight: 650 }}>实际日期</td>
            {allMilestones.map((milestone) => (
              <td key={`${milestone.id}-actual`} style={{ ...TABLE_CELL_STYLE, textAlign: "center", color: milestone.actualDate ? "var(--text-secondary)" : "var(--text-tertiary)" }}>
                {formatShortDate(milestone.actualDate) || "—"}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ ...TABLE_CELL_STYLE, position: "sticky", left: 0, zIndex: 2, background: "var(--bg-primary)", color: "var(--text-tertiary)", fontWeight: 650 }}>实际偏差</td>
            {allMilestones.map((milestone) => (
              <td key={`${milestone.id}-deviation`} style={{ ...TABLE_CELL_STYLE, textAlign: "center" }}>
                <ActualDeviationText signal={getMilestoneSignal(milestone, today, nextMilestoneId)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({
  milestone,
  signal,
  deleting,
  onEdit,
  onDelete,
  onClose,
}: {
  milestone: ProjectMilestone;
  signal: MilestoneSignal;
  deleting: boolean;
  onEdit: (milestone: ProjectMilestone) => void;
  onDelete: (milestoneId: string) => void;
  onClose: () => void;
}) {
  const actualDeviation = signal.actualDate ? signal.deviationLabel : "—";
  const sourceLink = milestone.sourceUrl ? (
    <a href={milestone.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>来源链接</a>
  ) : (
    "—"
  );

  return (
    <div className="card entity-card entity-card--compact" style={{ padding: "9px 10px", marginTop: 8, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4, minWidth: 0, flex: "1 1 520px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ color: "var(--text-primary)", fontSize: 15 }}>{milestone.title}</strong>
            <StatusPill signal={signal} />
            <DeviationText signal={signal} />
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 12, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {STAGE_LABELS[inferStageKey(milestone)]} · {PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || PROJECT_PLAN_TYPE_LABELS.milestone}
            {" · "}计划 {formatShortDate(milestone.targetDate) || "—"}
            {" · "}实际 {formatShortDate(milestone.actualDate) || "—"}
            {" · "}实际偏差 {actualDeviation}
            {" · "}负责人 {milestone.owner || "—"}
            {" · "}来源 {sourceLink}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn btn-secondary" style={{ ...VIEW_BUTTON_STYLE, height: 30, minHeight: 30, padding: "0 9px" }} onClick={() => onEdit(milestone)}>
            <Icon name="edit" size={13} />
            编辑
          </button>
          <button type="button" className="btn btn-secondary" style={{ ...VIEW_BUTTON_STYLE, height: 30, minHeight: 30, padding: "0 9px", color: "var(--accent-red)" }} disabled={deleting} onClick={() => onDelete(milestone.id)}>
            <Icon name="trash" size={13} />
            {deleting ? "删除中" : "删除"}
          </button>
          <button type="button" className="btn btn-secondary" style={{ ...VIEW_BUTTON_STYLE, height: 30, minHeight: 30, padding: "0 9px" }} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      <div
        style={{ color: milestone.description ? "var(--text-secondary)" : "var(--text-tertiary)", fontSize: 12, lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={milestone.description || ""}
      >
        说明 {milestone.description || "—"}
      </div>
    </div>
  );
}

function TimelineNodeCard({
  milestone,
  signal,
  onSelect,
}: {
  milestone: ProjectMilestone;
  signal: MilestoneSignal;
  onSelect: (milestone: ProjectMilestone) => void;
}) {
  const tone = TONE_STYLE[signal.tone];
  const isQuietFuture = !signal.isNext && !signal.isRisk && !signal.isDone && !signal.showDeviation;

  return (
    <button
      type="button"
      onClick={() => onSelect(milestone)}
      style={{
        minWidth: 128,
        maxWidth: 148,
        padding: signal.isNext || signal.isRisk || signal.isDone ? 10 : 9,
        borderRadius: 8,
        border: `1px solid ${signal.isNext ? "var(--accent-blue)" : tone.border}`,
        background: signal.isNext ? tone.background : signal.isRisk ? "color-mix(in srgb, var(--accent-red-light) 42%, var(--bg-primary))" : "var(--bg-primary)",
        color: "var(--text-primary)",
        textAlign: "left",
        cursor: "pointer",
        display: "grid",
        gap: isQuietFuture ? 4 : 5,
        boxShadow: signal.isNext ? "0 0 0 1px color-mix(in srgb, var(--accent-blue) 18%, transparent)" : "none",
      }}
      title={milestone.description || milestone.title}
    >
      {signal.isNext && <span style={{ color: "var(--accent-blue)", fontSize: 11, fontWeight: 700 }}>下一节点</span>}
      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{milestone.title}</strong>
      <span style={{ color: isQuietFuture ? "var(--text-tertiary)" : "var(--text-secondary)", fontSize: 12 }}>计划 {formatShortDate(milestone.targetDate) || "-"}</span>
      {signal.isDone && (
        <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>实际 {formatShortDate(milestone.actualDate) || "-"}</span>
      )}
      <span style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
        {isQuietFuture ? <StatusMark signal={signal} /> : <StatusPill signal={signal} />}
        <DeviationText signal={signal} />
      </span>
    </button>
  );
}

function getTimelineConnectorStyle(current: MilestoneSignal, next?: MilestoneSignal) {
  if (next?.isNext || current.isNext) {
    return { background: "var(--accent-blue)", height: 3, opacity: 0.78 };
  }
  if (current.isDone && next?.isDone) {
    return { background: "var(--accent-green)", height: 3, opacity: 0.62 };
  }
  if (current.isRisk || next?.isRisk) {
    return { background: "var(--accent-orange)", height: 3, opacity: 0.7 };
  }
  return { background: "var(--border-primary)", height: 2, opacity: 0.82 };
}

function TimelineView({
  groups,
  today,
  nextMilestoneId,
  onSelect,
}: {
  groups: StageGroup[];
  today: string;
  nextMilestoneId?: string | null;
  onSelect: (milestone: ProjectMilestone) => void;
}) {
  return (
    <div className="card" style={{ padding: 14, overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 18, minWidth: Math.max(760, groups.flatMap((group) => group.milestones).length * 158), alignItems: "stretch" }}>
        {groups.map((group, groupIndex) => (
          <div key={group.key} style={{ display: "grid", gap: 10, alignContent: "start", minWidth: Math.max(180, group.milestones.length * 150) }}>
            <div
              style={{
                padding: "4px 0 6px",
                borderBottom: "1px solid var(--border-primary)",
                color: "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              {group.label} · {group.milestones.length} 节点
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
              {group.milestones.map((milestone, index) => {
                const signal = getMilestoneSignal(milestone, today, nextMilestoneId);
                const nextSignal = group.milestones[index + 1]
                  ? getMilestoneSignal(group.milestones[index + 1], today, nextMilestoneId)
                  : undefined;
                const showConnector = index < group.milestones.length - 1;
                const connectorStyle = getTimelineConnectorStyle(signal, nextSignal);

                return (
                  <div key={milestone.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <TimelineNodeCard milestone={milestone} signal={signal} onSelect={onSelect} />
                    {showConnector && <span style={{ width: 34, borderRadius: 999, flex: "0 0 auto", ...connectorStyle }} />}
                  </div>
                );
              })}
              {groupIndex < groups.length - 1 && <span style={{ width: 28, height: 2, borderRadius: 999, background: "var(--border-primary)", opacity: 0.72, flex: "0 0 auto" }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectMilestoneSection({ projectId }: ProjectMilestoneSectionProps) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesError, setMilestonesError] = useState(false);
  const [milestoneActionError, setMilestoneActionError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showMilestoneCreateForm, setShowMilestoneCreateForm] = useState(false);
  const [milestoneCreateSaving, setMilestoneCreateSaving] = useState(false);
  const [milestoneCreateError, setMilestoneCreateError] = useState("");
  const [milestoneCreateForm, setMilestoneCreateForm] = useState<MilestoneFormState>(EMPTY_MILESTONE_FORM);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneEditSaving, setMilestoneEditSaving] = useState(false);
  const [milestoneEditError, setMilestoneEditError] = useState("");
  const [milestoneEditForm, setMilestoneEditForm] = useState<MilestoneFormState>(EMPTY_MILESTONE_FORM);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [selectedPlanType, setSelectedPlanType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const today = getLocalDateString();

  const validateMilestoneForm = useCallback((form: MilestoneFormState) => {
    if (!form.title.trim()) return "节点/计划名称不能为空";
    if (form.actualDate && !form.targetDate) return "填写实际日期前请先填写计划日期";
    return "";
  }, []);

  const buildMilestonePayload = useCallback((form: MilestoneFormState) => {
    const sortOrderValue = Number(form.sortOrder);

    return {
      title: form.title.trim(),
      description: form.description,
      status: form.status.trim() || "planned",
      planType: form.planType.trim() || "milestone",
      targetDate: form.targetDate || null,
      actualDate: form.actualDate || null,
      owner: form.owner,
      sourceUrl: form.sourceUrl,
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
    };
  }, []);

  const resetMilestoneCreateForm = useCallback(() => {
    setMilestoneCreateForm(EMPTY_MILESTONE_FORM);
    setMilestoneCreateError("");
  }, []);

  const resetMilestoneEditForm = useCallback(() => {
    setMilestoneEditForm(EMPTY_MILESTONE_FORM);
    setMilestoneEditError("");
  }, []);

  const fetchMilestones = useCallback(async () => {
    try {
      setMilestonesLoading(true);
      setMilestonesError(false);

      const res = await fetch(`/api/projects/${projectId}/milestones`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch project plans: ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Project plans response must be an array");

      setMilestones(data);
    } catch (error) {
      console.error("Error fetching project plans:", error);
      setMilestonesError(true);
    } finally {
      setMilestonesLoading(false);
    }
  }, [projectId]);

  const refreshMilestonesAfterSave = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, { cache: "no-store" });
      if (!res.ok) return false;

      const data = await res.json();
      if (!Array.isArray(data)) return false;

      setMilestones(data);
      setMilestonesError(false);
      return true;
    } catch (error) {
      console.error("Error refreshing project plans after save:", error);
      return false;
    }
  }, [projectId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  useEffect(() => {
    setSelectedMilestoneId(null);
  }, [viewMode]);

  const openMilestoneCreateForm = () => {
    resetMilestoneEditForm();
    setEditingMilestoneId(null);
    setSelectedMilestoneId(null);
    setMilestoneActionError("");
    resetMilestoneCreateForm();
    setShowMilestoneCreateForm(true);
  };

  const closeMilestoneCreateForm = () => {
    resetMilestoneCreateForm();
    setShowMilestoneCreateForm(false);
  };

  const openMilestoneEditForm = (milestone: ProjectMilestone) => {
    closeMilestoneCreateForm();
    setMilestoneActionError("");
    setEditingMilestoneId(milestone.id);
    setMilestoneEditError("");
    setMilestoneEditForm({
      title: milestone.title,
      description: milestone.description || "",
      status: milestone.status,
      planType: milestone.planType || "milestone",
      targetDate: toDateInputValue(milestone.targetDate),
      actualDate: toDateInputValue(milestone.actualDate),
      owner: milestone.owner || "",
      sourceUrl: milestone.sourceUrl || "",
      sortOrder: String(milestone.sortOrder),
    });
  };

  const closeMilestoneEditForm = () => {
    resetMilestoneEditForm();
    setEditingMilestoneId(null);
  };

  const handleMilestoneCreateSubmit = async () => {
    if (milestoneCreateSaving) return;

    const validationError = validateMilestoneForm(milestoneCreateForm);
    if (validationError) {
      setMilestoneCreateError(validationError);
      return;
    }

    setMilestoneCreateSaving(true);
    setMilestoneCreateError("");
    setMilestoneActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMilestonePayload(milestoneCreateForm)),
      });

      if (!res.ok) {
        setMilestoneCreateError("保存项目计划与节点失败");
        return;
      }

      const createdMilestone = await res.json();
      setMilestones((prev) => sortMilestones([createdMilestone, ...prev]));
      setMilestonesError(false);
      closeMilestoneCreateForm();
      setSelectedMilestoneId(createdMilestone.id);
      await refreshMilestonesAfterSave();
    } catch (error) {
      console.error("Error creating project plan:", error);
      setMilestoneCreateError("保存项目计划与节点失败");
    } finally {
      setMilestoneCreateSaving(false);
    }
  };

  const handleMilestoneEditSubmit = async (milestoneId: string) => {
    if (milestoneEditSaving) return;

    const validationError = validateMilestoneForm(milestoneEditForm);
    if (validationError) {
      setMilestoneEditError(validationError);
      return;
    }

    setMilestoneEditSaving(true);
    setMilestoneEditError("");
    setMilestoneActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMilestonePayload(milestoneEditForm)),
      });

      if (!res.ok) {
        setMilestoneEditError("更新项目计划与节点失败");
        return;
      }

      const updatedMilestone = await res.json();
      setMilestones((prev) => sortMilestones(prev.map((milestone) => (milestone.id === milestoneId ? updatedMilestone : milestone))));
      setMilestonesError(false);
      closeMilestoneEditForm();
      setSelectedMilestoneId(updatedMilestone.id);
      await refreshMilestonesAfterSave();
    } catch (error) {
      console.error("Error updating project plan:", error);
      setMilestoneEditError("更新项目计划与节点失败");
    } finally {
      setMilestoneEditSaving(false);
    }
  };

  const handleMilestoneDelete = async (milestoneId: string) => {
    if (deletingMilestoneId) return;
    if (!confirm("确认删除这个项目计划或节点吗？")) return;

    setDeletingMilestoneId(milestoneId);
    setMilestoneActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setMilestoneActionError("删除项目计划与节点失败");
        return;
      }

      setMilestones((prev) => prev.filter((milestone) => milestone.id !== milestoneId));
      if (editingMilestoneId === milestoneId) closeMilestoneEditForm();
      if (selectedMilestoneId === milestoneId) setSelectedMilestoneId(null);
      await refreshMilestonesAfterSave();
    } catch (error) {
      console.error("Error deleting project plan:", error);
      setMilestoneActionError("删除项目计划与节点失败");
    } finally {
      setDeletingMilestoneId(null);
    }
  };

  const filteredByPlanType = useMemo(() => {
    const typeFiltered = selectedPlanType === "all"
      ? milestones
      : milestones.filter((milestone) => (milestone.planType || "milestone") === selectedPlanType);

    if (selectedStatus === "all") return typeFiltered;
    return typeFiltered.filter((milestone) => milestone.status === selectedStatus);
  }, [milestones, selectedPlanType, selectedStatus]);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const displayedMilestones = useMemo(() => {
    const filteredByKeyword = normalizedKeyword
      ? filteredByPlanType.filter((milestone) => getMilestoneSearchText(milestone).includes(normalizedKeyword))
      : filteredByPlanType;

    return sortMilestones(filteredByKeyword);
  }, [filteredByPlanType, normalizedKeyword]);

  const sortedAllMilestones = useMemo(() => sortMilestones(milestones), [milestones]);
  const nextKeyMilestone = useMemo(() => findNextMilestone(sortedAllMilestones), [sortedAllMilestones]);
  const groupedMilestones = useMemo(() => groupMilestonesByStage(displayedMilestones), [displayedMilestones]);
  const selectedMilestone = selectedMilestoneId ? milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null : null;
  const riskMilestoneCount = milestones.filter((milestone) => getMilestoneSignal(milestone, today, nextKeyMilestone?.id).isRisk).length;
  const doneMilestoneCount = milestones.filter((milestone) => getMilestoneSignal(milestone, today, nextKeyMilestone?.id).isDone).length;
  const openMilestoneCount = milestones.length - doneMilestoneCount;
  const nextMilestoneSignal = nextKeyMilestone ? getMilestoneSignal(nextKeyMilestone, today, nextKeyMilestone.id) : null;

  return (
    <section className="cockpit-section">
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">PLANS & NODES</span>
          <h2>项目计划与节点</h2>
        </div>
        {!showMilestoneCreateForm && (
          <button
            type="button"
            onClick={openMilestoneCreateForm}
            className="btn btn-secondary"
          >
            <Icon name="plus" size={14} />
            新增节点/计划
          </button>
        )}
      </div>

      <div className="card entity-card entity-card--compact" style={{ padding: 12, marginBottom: 12, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => nextKeyMilestone && setSelectedMilestoneId(nextKeyMilestone.id)}
            disabled={!nextKeyMilestone}
            style={{
              minWidth: 260,
              flex: "1 1 360px",
              border: `1px solid ${nextKeyMilestone ? "color-mix(in srgb, var(--accent-blue) 30%, var(--border-primary))" : "var(--border-primary)"}`,
              borderRadius: 8,
              background: nextKeyMilestone ? "color-mix(in srgb, var(--accent-blue-light) 42%, var(--bg-primary))" : "var(--bg-primary)",
              padding: "10px 12px",
              textAlign: "left",
              color: "var(--text-secondary)",
              cursor: nextKeyMilestone ? "pointer" : "default",
              display: "grid",
              gap: 4,
              boxShadow: nextKeyMilestone ? "0 1px 0 color-mix(in srgb, var(--accent-blue) 12%, transparent)" : "none",
            }}
          >
            <span style={{ color: "var(--accent-blue)", fontSize: 11, fontWeight: 750, letterSpacing: 0 }}>下一节点</span>
            {nextKeyMilestone ? (
              <>
                <strong style={{ color: "var(--text-primary)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nextKeyMilestone.title}
                  {nextKeyMilestone.targetDate ? ` · ${formatShortDate(nextKeyMilestone.targetDate)}` : ""}
                  {nextKeyMilestone.owner ? ` · ${nextKeyMilestone.owner}` : ""}
                </strong>
                {nextMilestoneSignal && <DeviationText signal={nextMilestoneSignal} fallback="日期待定" />}
              </>
            ) : (
              <strong style={{ color: "var(--text-tertiary)", fontSize: 14 }}>暂无未完成节点</strong>
            )}
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", color: "var(--text-secondary)", fontSize: 13 }}>
            <span className="entity-pill entity-pill--muted">总数 {milestones.length}</span>
            <span className={riskMilestoneCount > 0 ? "entity-pill entity-pill--danger" : "entity-pill entity-pill--success"}>风险 {riskMilestoneCount}</span>
            <span className="entity-pill entity-pill--muted">未完成 {openMilestoneCount}</span>
            <span className="entity-pill entity-pill--muted">已完成 {doneMilestoneCount}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border-secondary)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => setSelectedPlanType("all")}
              className={`btn ${selectedPlanType === "all" ? "btn-primary" : "btn-secondary"}`}
              style={VIEW_BUTTON_STYLE}
            >
              全部
            </button>
            {PROJECT_PLAN_TYPES.map((planType) => (
              <button
                key={planType.value}
                type="button"
                onClick={() => setSelectedPlanType(planType.value)}
                className={`btn ${selectedPlanType === planType.value ? "btn-primary" : "btn-secondary"}`}
                style={VIEW_BUTTON_STYLE}
              >
                {PROJECT_PLAN_TYPE_LABELS[planType.value] || planType.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flex: "1 1 360px", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className={`btn ${viewMode === "list" ? "btn-primary" : "btn-secondary"}`} style={VIEW_BUTTON_STYLE} onClick={() => setViewMode("list")}>
                列表
              </button>
              <button type="button" className={`btn ${viewMode === "timeline" ? "btn-primary" : "btn-secondary"}`} style={VIEW_BUTTON_STYLE} onClick={() => setViewMode("timeline")}>
                时间轴
              </button>
            </div>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} style={{ ...INPUT_STYLE, width: 128, height: 36, padding: "0 9px" }} title="状态筛选">
              <option value="all">全部状态</option>
              {PROJECT_MILESTONE_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          <div style={{ minWidth: 240, maxWidth: 360, flex: "1 1 260px", position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-tertiary)", display: "inline-flex" }}>
              <Icon name="search" size={14} />
            </span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="查询名称、类型、状态、负责人、说明"
                style={{ ...INPUT_STYLE, paddingLeft: 30 }}
              />
            </div>
          </div>
        </div>
      </div>

      {milestoneActionError && (
        <div className="feedback-note feedback-note--error" style={{ marginBottom: 12 }}>
          {milestoneActionError}
        </div>
      )}

      {showMilestoneCreateForm && (
        <MilestoneFormPanel
          title="新增节点/计划"
          form={milestoneCreateForm}
          setForm={setMilestoneCreateForm}
          saving={milestoneCreateSaving}
          error={milestoneCreateError}
          onSave={() => void handleMilestoneCreateSubmit()}
          onCancel={closeMilestoneCreateForm}
        />
      )}

      {editingMilestoneId && (
        <MilestoneFormPanel
          title="编辑节点/计划"
          form={milestoneEditForm}
          setForm={setMilestoneEditForm}
          saving={milestoneEditSaving}
          error={milestoneEditError}
          onSave={() => void handleMilestoneEditSubmit(editingMilestoneId)}
          onCancel={closeMilestoneEditForm}
        />
      )}

      {milestonesLoading ? (
        <div className="card empty-state">
          <p>加载中...</p>
        </div>
      ) : milestonesError && milestones.length === 0 ? (
        <div className="card empty-state">
          <p>项目计划与节点加载失败</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void fetchMilestones()}>
              重试
            </button>
          </div>
        </div>
      ) : milestones.length === 0 && !showMilestoneCreateForm ? (
        <div className="card empty-state">
          <p>可补充关键里程碑、管理节点或阶段计划，便于判断项目节奏。</p>
        </div>
      ) : displayedMilestones.length === 0 ? (
        <div className="card empty-state">
          <p>当前筛选/查询条件下暂无项目计划与节点</p>
        </div>
      ) : viewMode === "timeline" ? (
        <TimelineView
          groups={groupedMilestones}
          today={today}
          nextMilestoneId={nextKeyMilestone?.id}
          onSelect={(milestone) => setSelectedMilestoneId((currentId) => (currentId === milestone.id ? null : milestone.id))}
        />
      ) : (
        <CompactPlanMatrix
          groups={groupedMilestones}
          today={today}
          nextMilestoneId={nextKeyMilestone?.id}
          onSelect={(milestone) => setSelectedMilestoneId((currentId) => (currentId === milestone.id ? null : milestone.id))}
        />
      )}

      {selectedMilestone && !editingMilestoneId && (
        <DetailPanel
          milestone={selectedMilestone}
          signal={getMilestoneSignal(selectedMilestone, today, nextKeyMilestone?.id)}
          deleting={deletingMilestoneId === selectedMilestone.id}
          onEdit={openMilestoneEditForm}
          onDelete={handleMilestoneDelete}
          onClose={() => setSelectedMilestoneId(null)}
        />
      )}
    </section>
  );
}
