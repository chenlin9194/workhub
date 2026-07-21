"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Icon from "@/components/Icon";
import {
  PROJECT_MILESTONE_DATE_MODES,
  PROJECT_MILESTONE_DATE_MODE_LABELS,
  PROJECT_MILESTONE_STAGES,
  PROJECT_MILESTONE_STAGE_LABELS,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_PLAN_TYPES,
  PROJECT_PLAN_TYPE_LABELS,
} from "@/lib/constants";
import {
  UNSET_MILESTONE_STAGE_KEY,
  getActualPointDate,
  getActualRange,
  getMilestoneActualEnd,
  getMilestoneDateMode,
  getMilestonePlannedEnd,
  getMilestoneStageKey,
  getPlannedPointDate,
  getPlannedRange,
  getScheduleSignalCounts,
  isPointDelayed,
  isPointMilestone,
  isRangeEndDelayed,
  isRangePlan,
  isRangeStartDelayed,
  normalizeStage,
  normalizeDateMode,
} from "@/lib/projectMilestones";
import { formatDate, getLocalDateString } from "@/lib/utils";
import type { ProjectMilestone } from "@/lib/types";

type MilestoneFormState = {
  title: string;
  description: string;
  status: string;
  stage: string;
  planType: string;
  dateMode: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
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
  plannedStartDate: string;
  actualStartDate: string;
  daysLeft?: number;
  isNext: boolean;
  isNear: boolean;
  isDone: boolean;
  isRisk: boolean;
  isPointDelayed?: boolean;
  isRangeStartDelayed?: boolean;
  isRangeEndDelayed?: boolean;
  showDeviation: boolean;
};

type TimelineScheduleKind = "point" | "range" | "start-only" | "end-only";

type TimelineScheduledItem = {
  milestone: ProjectMilestone;
  dateMode: string;
  planType: string;
  start: string;
  end: string;
  scheduleKind: TimelineScheduleKind;
  scheduleNote?: string;
};

const EMPTY_MILESTONE_FORM: MilestoneFormState = {
  title: "",
  description: "",
  status: "planned",
  stage: "planning",
  planType: "milestone",
  dateMode: "point",
  plannedStartDate: "",
  plannedEndDate: "",
  actualStartDate: "",
  actualEndDate: "",
  owner: "",
  sourceUrl: "",
  sortOrder: "0",
};

const CLOSED_MILESTONE_STATUSES = new Set(["done", "cancelled"]);

const STAGE_ORDER: string[] = [...PROJECT_MILESTONE_STAGES.map((stage) => stage.value), UNSET_MILESTONE_STAGE_KEY];
const LANE_ORDER: string[] = PROJECT_PLAN_TYPES.map((type) => type.value);

const INPUT_STYLE = {
  width: "100%",
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
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

function getMonthLastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function getHalfMonthStart(value: string) {
  const { year, month, day } = parseYmd(value);
  const halfStartDay = day <= 15 ? 1 : 16;
  return `${year}-${String(month).padStart(2, "0")}-${String(halfStartDay).padStart(2, "0")}`;
}

function getHalfMonthEnd(value: string) {
  const { year, month, day } = parseYmd(value);
  const halfEndDay = day <= 15 ? 15 : getMonthLastDay(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(halfEndDay).padStart(2, "0")}`;
}

function getNextHalfMonthStart(value: string) {
  const { year, month, day } = parseYmd(value);
  if (day <= 15) return `${year}-${String(month).padStart(2, "0")}-16`;

  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}-01`;
}

function getHalfMonthLabel(value: string) {
  const { year, month, day } = parseYmd(value);
  return `${year}/${month} ${day <= 15 ? "上旬" : "下旬"}`;
}

function buildHalfMonthTicks(start: string, end: string) {
  const ticks: string[] = [];
  let cursor = getHalfMonthStart(start);
  const endKey = getHalfMonthStart(end);

  while (cursor <= endKey) {
    ticks.push(cursor);
    cursor = getNextHalfMonthStart(cursor);
  }

  return ticks;
}

function formatShortDate(value?: string | Date | null) {
  if (!value) return "";
  return formatDate(value);
}

function formatDateRange(start?: string | Date | null, end?: string | Date | null) {
  const startText = formatShortDate(start);
  const endText = formatShortDate(end);
  if (startText && endText) return `${startText} 至 ${endText}`;
  return startText || endText || "";
}

function formatCompactDateRange(start?: string | Date | null, end?: string | Date | null) {
  const startText = formatShortDate(start);
  const endText = formatShortDate(end);
  if (startText && endText) return `${startText}-${endText}`;
  if (startText) return `${startText}-待补`;
  if (endText) return `待补-${endText}`;
  return "未排期";
}

function getCompactScheduleText(milestone: ProjectMilestone) {
  if (isRangePlan(milestone)) {
    return formatCompactDateRange(milestone.plannedStartDate, getMilestonePlannedEnd(milestone));
  }

  return formatShortDate(getMilestonePlannedEnd(milestone)) || "未排期";
}

function getStageLabel(key: string) {
  if (key === UNSET_MILESTONE_STAGE_KEY) return "阶段未设置";
  return PROJECT_MILESTONE_STAGE_LABELS[key] || "阶段未设置";
}

function getPlannedDateText(milestone: ProjectMilestone) {
  if (isRangePlan(milestone)) {
    return formatDateRange(milestone.plannedStartDate, getMilestonePlannedEnd(milestone));
  }

  return formatShortDate(getMilestonePlannedEnd(milestone));
}

function getActualDateText(milestone: ProjectMilestone) {
  if (isRangePlan(milestone)) {
    return formatDateRange(milestone.actualStartDate, getMilestoneActualEnd(milestone));
  }

  return formatShortDate(getMilestoneActualEnd(milestone));
}

function getTimelineSchedule(milestone: ProjectMilestone): TimelineScheduledItem | null {
  const dateMode = getMilestoneDateMode(milestone);
  const plannedStart = getDateKey(milestone.plannedStartDate);
  const plannedEnd = getDateKey(getMilestonePlannedEnd(milestone));
  const planType = milestone.planType || "milestone";

  if (isPointMilestone(milestone)) {
    if (!plannedEnd) return null;

    return {
      milestone,
      dateMode,
      planType,
      start: plannedEnd,
      end: plannedEnd,
      scheduleKind: "point",
    };
  }

  if (plannedStart && plannedEnd) {
    return {
      milestone,
      dateMode,
      planType,
      start: plannedStart,
      end: plannedEnd,
      scheduleKind: "range",
    };
  }

  if (plannedStart) {
    return {
      milestone,
      dateMode,
      planType,
      start: plannedStart,
      end: plannedStart,
      scheduleKind: "start-only",
      scheduleNote: "待补结束",
    };
  }

  if (plannedEnd) {
    return {
      milestone,
      dateMode,
      planType,
      start: plannedEnd,
      end: plannedEnd,
      scheduleKind: "end-only",
      scheduleNote: "待补开始",
    };
  }

  return null;
}

function getUnscheduledReason(milestone: ProjectMilestone) {
  return isRangePlan(milestone) ? "缺计划开始/结束" : "缺计划日期";
}

function isMilestoneClosed(milestone: ProjectMilestone) {
  return CLOSED_MILESTONE_STATUSES.has(milestone.status);
}

function getMilestoneSearchText(milestone: ProjectMilestone) {
  return [
    milestone.title,
    getStageLabel(getMilestoneStageKey(milestone)),
    PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || milestone.planType,
    PROJECT_MILESTONE_DATE_MODE_LABELS[getMilestoneDateMode(milestone)],
    PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status,
    milestone.owner,
    milestone.description,
    milestone.sourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function groupMilestonesByStage(milestones: ProjectMilestone[]): StageGroup[] {
  const groups = new Map<string, ProjectMilestone[]>();

  milestones.forEach((milestone) => {
    const key = getMilestoneStageKey(milestone);
    groups.set(key, [...(groups.get(key) || []), milestone]);
  });

  return STAGE_ORDER.map((key) => ({
    key,
    label: getStageLabel(key),
    milestones: groups.get(key) || [],
  }));
}

function getStageSortIndex(stageKey: string) {
  const index = STAGE_ORDER.indexOf(stageKey);
  return index >= 0 ? index : STAGE_ORDER.length;
}

function sortMilestones(milestones: ProjectMilestone[]) {
  return [...milestones].sort((a, b) => {
    const aStage = getStageSortIndex(getMilestoneStageKey(a));
    const bStage = getStageSortIndex(getMilestoneStageKey(b));
    if (aStage !== bStage) return aStage - bStage;

    const aDate = getDateKey(getMilestonePlannedEnd(a));
    const bDate = getDateKey(getMilestonePlannedEnd(b));
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;

    const sortOrderDiff = a.sortOrder - b.sortOrder;
    if (sortOrderDiff !== 0) return sortOrderDiff;

    return a.title.localeCompare(b.title, "zh-CN");
  });
}

function findNextMilestone(milestones: ProjectMilestone[]) {
  const candidates = milestones.filter((milestone) => !getMilestoneActualEnd(milestone) && !isMilestoneClosed(milestone));
  if (candidates.length === 0) return null;
  return sortMilestones(candidates)[0] ?? null;
}

function getMilestoneSignal(milestone: ProjectMilestone, today: string, nextMilestoneId?: string | null): MilestoneSignal {
  const plannedDate = getDateKey(getMilestonePlannedEnd(milestone));
  const actualDate = getDateKey(getMilestoneActualEnd(milestone));
  const plannedStartDate = getDateKey(milestone.plannedStartDate);
  const actualStartDate = getDateKey(milestone.actualStartDate);
  const isNext = Boolean(nextMilestoneId && milestone.id === nextMilestoneId);
  const rangeStartLate = isRangeStartDelayed(milestone, today);
  const rangeEndLate = isRangeEndDelayed(milestone, today);

  if (rangeStartLate || rangeEndLate) {
    return {
      statusLabel: isNext ? "下一节点" : rangeStartLate && rangeEndLate ? "晚启/晚结" : rangeStartLate ? "晚启" : "晚结",
      deviationLabel: rangeStartLate && rangeEndLate ? "晚启 / 晚结" : rangeStartLate ? "晚启" : "晚结",
      tone: "risk",
      plannedDate,
      actualDate,
      plannedStartDate,
      actualStartDate,
      isNext,
      isNear: false,
      isDone: false,
      isRisk: true,
      isRangeStartDelayed: rangeStartLate,
      isRangeEndDelayed: rangeEndLate,
      showDeviation: true,
    };
  }

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
          plannedStartDate,
          actualStartDate,
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
          plannedStartDate,
          actualStartDate,
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
        plannedStartDate,
        actualStartDate,
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
      plannedStartDate,
      actualStartDate,
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
      plannedStartDate,
      actualStartDate,
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
      plannedStartDate,
      actualStartDate,
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
    plannedStartDate,
    actualStartDate,
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

function DateValue({ value, delayed }: { value?: string | Date | null; delayed?: boolean }) {
  const text = formatShortDate(value);
  if (!text) return <span style={{ color: "var(--text-tertiary)" }}>待补</span>;

  return (
    <span style={{ color: delayed ? "var(--accent-red)" : "inherit", fontWeight: delayed ? 750 : 500 }}>
      {text}
    </span>
  );
}

function DateRangeValue({
  start,
  end,
  startDelayed,
  endDelayed,
}: {
  start?: string | Date | null;
  end?: string | Date | null;
  startDelayed?: boolean;
  endDelayed?: boolean;
}) {
  return (
    <>
      <DateValue value={start} delayed={startDelayed} />
      <span style={{ color: "var(--text-tertiary)" }}> 至 </span>
      <DateValue value={end} delayed={endDelayed} />
    </>
  );
}

function TimelineItemDetails({
  item,
  today,
}: {
  item: TimelineScheduledItem;
  today: string;
}) {
  const milestone = item.milestone;
  const isRange = isRangePlan(milestone);
  const actualPointDate = getActualPointDate(milestone);
  const plannedRange = getPlannedRange(milestone);
  const actualRange = getActualRange(milestone);
  const hasActualRange = Boolean(actualRange.start || actualRange.end);

  return (
    <div
      style={{
        display: "grid",
        gap: 2,
        padding: "5px 7px",
        borderRadius: 6,
        border: "1px solid var(--border-secondary)",
        background: "color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary))",
        color: "var(--text-secondary)",
        fontSize: 11,
        lineHeight: 1.45,
        boxShadow: "0 4px 12px color-mix(in srgb, var(--text-primary) 8%, transparent)",
      }}
    >
      {isRange ? (
        <>
          {item.scheduleKind === "start-only" ? (
            <span>
              计划开始: <DateValue value={plannedRange.start} />，待补结束
            </span>
          ) : item.scheduleKind === "end-only" ? (
            <span>
              计划结束: <DateValue value={plannedRange.end} />，待补开始
            </span>
          ) : (
            <span>
              计划周期: <DateRangeValue start={plannedRange.start} end={plannedRange.end} />
            </span>
          )}
          {hasActualRange ? (
            <span>
              实际周期: <DateRangeValue start={actualRange.start} end={actualRange.end} startDelayed={isRangeStartDelayed(milestone, today)} endDelayed={isRangeEndDelayed(milestone, today)} />
            </span>
          ) : (
            <span style={{ color: "var(--text-tertiary)" }}>实际周期待补</span>
          )}
        </>
      ) : (
        <>
          <span>
            计划日期: <DateValue value={getPlannedPointDate(milestone)} />
          </span>
          {actualPointDate ? (
            <span>
              实际日期: <DateValue value={actualPointDate} delayed={isPointDelayed(milestone, today)} />
            </span>
          ) : (
            <span style={{ color: "var(--text-tertiary)" }}>实际日期待补</span>
          )}
        </>
      )}
    </div>
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
  const dateMode = normalizeDateMode(form.dateMode, form.planType);

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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(120px, 0.75fr) minmax(130px, 0.8fr) minmax(120px, 0.7fr) minmax(122px, 0.7fr)", gap: 10, alignItems: "start" }}>
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
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>阶段</span>
          <MilestoneSelect
            value={form.stage}
            onChange={(value) => setForm((prev) => ({ ...prev, stage: value }))}
            options={PROJECT_MILESTONE_STAGES}
          />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>类型</span>
          <MilestoneSelect
            value={form.planType}
            onChange={(value) => setForm((prev) => ({ ...prev, planType: value, dateMode: normalizeDateMode(prev.dateMode, value) }))}
            options={PROJECT_PLAN_TYPES}
          />
        </label>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>日期模式</span>
          {form.planType === "other" ? (
            <MilestoneSelect
              value={dateMode}
              onChange={(value) => setForm((prev) => ({ ...prev, dateMode: value }))}
              options={PROJECT_MILESTONE_DATE_MODES}
            />
          ) : (
            <div
              style={{
                minHeight: 34,
                display: "flex",
                alignItems: "center",
                padding: "0 9px",
                borderRadius: 8,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              时间模式：{PROJECT_MILESTONE_DATE_MODE_LABELS[dateMode]}
            </div>
          )}
        </div>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>状态</span>
          <MilestoneSelect
            value={form.status}
            onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
            options={PROJECT_MILESTONE_STATUSES}
          />
        </label>
      </div>

      {dateMode === "range" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>计划开始</span>
            <MilestoneInput
              type="date"
              value={form.plannedStartDate}
              onChange={(value) => setForm((prev) => ({ ...prev, plannedStartDate: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>计划结束</span>
            <MilestoneInput
              type="date"
              value={form.plannedEndDate}
              onChange={(value) => setForm((prev) => ({ ...prev, plannedEndDate: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>实际开始</span>
            <MilestoneInput
              type="date"
              value={form.actualStartDate}
              onChange={(value) => setForm((prev) => ({ ...prev, actualStartDate: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>实际结束</span>
            <MilestoneInput
              type="date"
              value={form.actualEndDate}
              onChange={(value) => setForm((prev) => ({ ...prev, actualEndDate: value }))}
            />
          </label>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>计划日期</span>
            <MilestoneInput
              type="date"
              value={form.plannedEndDate}
              onChange={(value) => setForm((prev) => ({ ...prev, plannedEndDate: value }))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>实际日期</span>
            <MilestoneInput
              type="date"
              value={form.actualEndDate}
              onChange={(value) => setForm((prev) => ({ ...prev, actualEndDate: value }))}
            />
          </label>
        </div>
      )}

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

const COMPACT_STAGE_LIMIT = 8;
const MAIN_STAGE_KEYS: Set<string> = new Set(PROJECT_MILESTONE_STAGES.map((stage) => stage.value));

function getCompactStatusText(signal: MilestoneSignal) {
  if (signal.isRisk) return signal.deviationLabel;
  return signal.statusLabel;
}

function getCompactScheduleSortDate(milestone: ProjectMilestone) {
  if (isRangePlan(milestone)) {
    return getDateKey(getMilestonePlannedEnd(milestone)) || getDateKey(milestone.plannedStartDate);
  }

  return getDateKey(getMilestonePlannedEnd(milestone));
}

function sortCompactStageMilestones(milestones: ProjectMilestone[]) {
  return [...milestones].sort((a, b) => {
    const aDate = getCompactScheduleSortDate(a);
    const bDate = getCompactScheduleSortDate(b);
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;

    const sortOrderDiff = a.sortOrder - b.sortOrder;
    if (sortOrderDiff !== 0) return sortOrderDiff;

    return a.title.localeCompare(b.title, "zh-CN");
  });
}

function isActualPointLate(milestone: ProjectMilestone) {
  const plannedDate = getDateKey(getMilestonePlannedEnd(milestone));
  const actualDate = getDateKey(getMilestoneActualEnd(milestone));
  return Boolean(plannedDate && actualDate && actualDate > plannedDate);
}

function isActualRangeStartLate(milestone: ProjectMilestone) {
  const plannedStart = getDateKey(milestone.plannedStartDate);
  const actualStart = getDateKey(milestone.actualStartDate);
  return Boolean(plannedStart && actualStart && actualStart > plannedStart);
}

function isActualRangeEndLate(milestone: ProjectMilestone) {
  const plannedEnd = getDateKey(getMilestonePlannedEnd(milestone));
  const actualEnd = getDateKey(getMilestoneActualEnd(milestone));
  return Boolean(plannedEnd && actualEnd && actualEnd > plannedEnd);
}

function CompactRowDetails({ milestone }: { milestone: ProjectMilestone }) {
  const isRange = isRangePlan(milestone);
  const plannedRange = getPlannedRange(milestone);
  const actualRange = getActualRange(milestone);
  const actualPointDate = getActualPointDate(milestone);
  const hasActualRange = Boolean(actualRange.start || actualRange.end);

  return (
    <div
      style={{
        margin: "0 6px 5px 30px",
        padding: "6px 8px",
        borderLeft: "2px solid var(--border-secondary)",
        display: "grid",
        gap: 4,
        color: "var(--text-secondary)",
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      {isRange ? (
        <>
          <span>
            计划周期: <DateRangeValue start={plannedRange.start} end={plannedRange.end} />
          </span>
          <span>
            实际周期:{" "}
            {hasActualRange ? (
              <DateRangeValue
                start={actualRange.start}
                end={actualRange.end}
                startDelayed={isActualRangeStartLate(milestone)}
                endDelayed={isActualRangeEndLate(milestone)}
              />
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>待补</span>
            )}
          </span>
        </>
      ) : (
        <>
          <span>
            计划日期: <DateValue value={getPlannedPointDate(milestone)} />
          </span>
          <span>
            实际日期:{" "}
            {actualPointDate ? (
              <DateValue value={actualPointDate} delayed={isActualPointLate(milestone)} />
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>待补</span>
            )}
          </span>
        </>
      )}
      {milestone.owner && <span>负责人: {milestone.owner}</span>}
      {milestone.description && (
        <span style={{ overflowWrap: "anywhere" }}>
          说明: {milestone.description}
        </span>
      )}
    </div>
  );
}

function CompactPlanMatrix({
  groups,
  today,
  nextMilestoneId,
  selectedMilestoneId,
  showAllMatched,
  onSelect,
}: {
  groups: StageGroup[];
  today: string;
  nextMilestoneId?: string | null;
  selectedMilestoneId?: string | null;
  showAllMatched?: boolean;
  onSelect: (milestone: ProjectMilestone) => void;
}) {
  const [expandedStageKeys, setExpandedStageKeys] = useState<Set<string>>(new Set());
  const mainGroups = groups.filter((group) => group.key !== UNSET_MILESTONE_STAGE_KEY && MAIN_STAGE_KEYS.has(group.key));
  const unsetGroup = groups.find((group) => group.key === UNSET_MILESTONE_STAGE_KEY);

  const toggleStage = (stageKey: string) => {
    setExpandedStageKeys((current) => {
      const next = new Set(current);
      if (next.has(stageKey)) {
        next.delete(stageKey);
      } else {
        next.add(stageKey);
      }
      return next;
    });
  };

  const renderStageColumn = (group: StageGroup, muted = false) => {
    const orderedMilestones = sortCompactStageMilestones(group.milestones);
    const expandedStage = expandedStageKeys.has(group.key);
    const limited = !showAllMatched && !expandedStage && orderedMilestones.length > COMPACT_STAGE_LIMIT;
    const selectedInStage = selectedMilestoneId
      ? orderedMilestones.find((milestone) => milestone.id === selectedMilestoneId)
      : null;
    const baseVisibleMilestones = limited ? orderedMilestones.slice(0, COMPACT_STAGE_LIMIT) : orderedMilestones;
    const visibleMilestones = limited && selectedInStage && !baseVisibleMilestones.some((milestone) => milestone.id === selectedInStage.id)
      ? [...baseVisibleMilestones, selectedInStage]
      : baseVisibleMilestones;

    return (
      <div
        key={group.key}
        style={{
          minWidth: 0,
          display: "grid",
          alignContent: "start",
          gap: 2,
          padding: "8px 7px",
          borderRadius: 8,
          border: muted ? "1px dashed var(--border-secondary)" : "1px solid var(--border-secondary)",
          background: muted ? "color-mix(in srgb, var(--bg-secondary) 42%, transparent)" : "var(--bg-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "0 3px 5px",
            color: muted ? "var(--text-tertiary)" : "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 750,
          }}
        >
          <span>{group.label} · {group.milestones.length}</span>
        </div>

        {visibleMilestones.map((milestone) => {
          const signal = getMilestoneSignal(milestone, today, nextMilestoneId);
          const tone = TONE_STYLE[signal.tone];
          const selected = selectedMilestoneId === milestone.id;
          const isRange = isRangePlan(milestone);
          const statusText = getCompactStatusText(signal);
          const symbol = isRange ? "▰" : "●";
          const scheduleText = getCompactScheduleText(milestone);

          return (
            <div key={milestone.id} style={{ display: "grid", gap: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => onSelect(milestone)}
                title={milestone.title}
                aria-label={`${milestone.title} ${scheduleText} ${statusText}`}
                style={{
                  width: "100%",
                  minHeight: 30,
                  padding: "0 5px",
                  border: `1px solid ${selected ? tone.border : "transparent"}`,
                  borderRadius: 6,
                  background: selected ? "var(--bg-secondary)" : signal.isNext ? "color-mix(in srgb, var(--accent-blue-light) 34%, var(--bg-primary))" : "transparent",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "14px minmax(0, 1fr) minmax(54px, auto) minmax(42px, auto)",
                  gap: 5,
                  alignItems: "center",
                  textAlign: "left",
                }}
              >
                <span style={{ color: isRange ? "var(--accent-blue)" : tone.color, fontSize: isRange ? 11 : 12, lineHeight: 1, textAlign: "center" }}>
                  {symbol}
                </span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: selected || signal.isNext ? 700 : 560 }}>
                  {milestone.title}
                </span>
                <span style={{ color: scheduleText === "未排期" ? "var(--text-tertiary)" : "var(--text-secondary)", fontSize: 11, whiteSpace: "nowrap", justifySelf: "end" }}>
                  {scheduleText}
                </span>
                <span style={{ color: signal.isRisk ? "var(--accent-red)" : signal.isNext ? "var(--accent-blue)" : tone.color, fontSize: 11, fontWeight: signal.isRisk || signal.isNext ? 700 : 600, whiteSpace: "nowrap", justifySelf: "end" }}>
                  {statusText}
                </span>
              </button>
              {selected && <CompactRowDetails milestone={milestone} />}
            </div>
          );
        })}

        {!showAllMatched && group.milestones.length > COMPACT_STAGE_LIMIT && (
          <button
            type="button"
            onClick={() => toggleStage(group.key)}
            className="btn btn-secondary"
            style={{ ...VIEW_BUTTON_STYLE, width: "max-content", height: 28, minHeight: 28, margin: "4px 0 0 22px", padding: "0 9px", fontSize: 12 }}
          >
            {expandedStage ? "收起" : `展开全部 ${group.milestones.length} 条`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: 10, display: "grid", gap: 10 }}>
      <style jsx>{`
        .compact-stage-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 10px;
        }

        @media (min-width: 900px) {
          .compact-stage-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1280px) {
          .compact-stage-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
      {mainGroups.length > 0 && (
        <div className="compact-stage-grid">
          {mainGroups.map((group) => renderStageColumn(group))}
        </div>
      )}
      {unsetGroup && (
        <div style={{ display: "grid", gap: 6 }}>
          {renderStageColumn(unsetGroup, true)}
        </div>
      )}
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
  const stageLabel = getStageLabel(getMilestoneStageKey(milestone));
  const dateMode = getMilestoneDateMode(milestone);
  const plannedLabel = dateMode === "range" ? "计划周期" : "计划日期";
  const actualLabel = dateMode === "range" ? "实际周期" : "实际日期";
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
            {stageLabel} · {PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || PROJECT_PLAN_TYPE_LABELS.milestone}
            {" · "}{PROJECT_MILESTONE_DATE_MODE_LABELS[dateMode]}
            {" · "}{plannedLabel} {getPlannedDateText(milestone) || "—"}
            {" · "}{actualLabel} {getActualDateText(milestone) || "—"}
            {" · "}偏差 {actualDeviation}
            {" · "}负责人 {milestone.owner || "—"}
            {" · "}来源 {sourceLink}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn btn-secondary" style={{ ...VIEW_BUTTON_STYLE, height: 30, minHeight: 30, padding: "0 9px" }} onClick={() => onEdit(milestone)}>
            <Icon name="edit" size={13} />
            编辑
          </button>
          <button type="button" className="btn btn-danger" style={{ ...VIEW_BUTTON_STYLE, height: 30, minHeight: 30, padding: "0 9px" }} disabled={deleting} onClick={() => onDelete(milestone.id)}>
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

function TimelineView({
  groups,
  today,
  nextMilestoneId,
  selectedMilestoneId,
  onSelect,
}: {
  groups: StageGroup[];
  today: string;
  nextMilestoneId?: string | null;
  selectedMilestoneId?: string | null;
  onSelect: (milestone: ProjectMilestone) => void;
}) {
  const milestones = groups.flatMap((group) => group.milestones);
  const scheduledItems = milestones
    .map(getTimelineSchedule)
    .filter(Boolean) as TimelineScheduledItem[];
  const scheduledIds = new Set(scheduledItems.map((item) => item.milestone.id));
  const unscheduledItems = milestones.filter((milestone) => !scheduledIds.has(milestone.id));
  const dateValues = scheduledItems.flatMap((item) => [item.start, item.end]);
  const scheduledLanes = LANE_ORDER.map((planType) => ({
    planType,
    items: scheduledItems.filter((item) => item.planType === planType),
  })).filter((lane) => lane.items.length > 0);

  const tickStart = dateValues.length > 0 ? getHalfMonthStart(dateValues.sort()[0]) : "";
  const tickEnd = dateValues.length > 0 ? getHalfMonthEnd([...dateValues].sort().at(-1) || dateValues[0]) : "";
  const ticks = tickStart && tickEnd ? buildHalfMonthTicks(tickStart, tickEnd) : [];
  const tickIndexByKey = new Map(ticks.map((tick, index) => [tick, index]));
  const todayTickIndex = tickIndexByKey.get(getHalfMonthStart(today));
  const gridTemplateColumns = `repeat(${Math.max(1, ticks.length)}, minmax(86px, 1fr))`;

  return (
    <div className="card" style={{ padding: 14, overflowX: "auto" }}>
      <div style={{ minWidth: 920, display: "grid", gap: 12 }}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {groups.map((group) => (
            <div
              key={group.key}
              style={{
                padding: "7px 8px",
                borderRadius: 8,
                background: group.milestones.length > 0 ? "var(--bg-secondary)" : "transparent",
                border: group.milestones.length > 0 ? "1px solid var(--border-secondary)" : "1px dashed color-mix(in srgb, var(--border-secondary) 55%, transparent)",
                color: group.milestones.length > 0 ? "var(--text-secondary)" : "var(--text-tertiary)",
                opacity: group.milestones.length > 0 ? 1 : 0.45,
                fontSize: 12,
                fontWeight: 750,
              }}
            >
              {group.label} · {group.milestones.length}
            </div>
          ))}
        </div>
        {scheduledItems.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10, alignItems: "stretch" }}>
              <div />
              <div style={{ display: "grid", gridTemplateColumns, border: "1px solid var(--border-secondary)", borderRadius: 8, overflow: "hidden", background: "var(--bg-secondary)" }}>
                {ticks.map((tick, index) => (
                  <div
                    key={tick}
                    style={{
                      minHeight: 32,
                      padding: "6px 7px",
                      borderLeft: index === 0 ? "none" : "1px solid var(--border-secondary)",
                      color: "var(--text-tertiary)",
                      fontSize: 11,
                      fontWeight: 650,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getHalfMonthLabel(tick)}
                  </div>
                ))}
              </div>
            </div>

            {scheduledLanes.map(({ planType, items }) => {
              const isPointLane = items.every((item) => item.scheduleKind === "point");
              const pointItemsByTick = new Map<string, TimelineScheduledItem[]>();
              items.forEach((item) => {
                if (!isPointLane) return;
                const tick = getHalfMonthStart(item.start);
                pointItemsByTick.set(tick, [...(pointItemsByTick.get(tick) || []), item]);
              });
              const maxPointStack = Math.max(1, ...Array.from(pointItemsByTick.values()).map((tickItems) => tickItems.length));
              const rowCount = isPointLane ? 1 : Math.max(1, items.length);
              const rowHeight = 26;
              const laneMinHeight = isPointLane
                ? Math.max(52, Math.min(92, maxPointStack * 26 + 16))
                : Math.max(58, rowCount * rowHeight + 16);

              return (
                <div key={planType} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10, alignItems: "stretch" }}>
                <div style={{ color: "var(--text-tertiary)", fontSize: 12, fontWeight: 700, paddingTop: 12 }}>
                  {PROJECT_PLAN_TYPE_LABELS[planType] || planType}
                </div>
                <div
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns,
                    gridTemplateRows: isPointLane ? "1fr" : `repeat(${rowCount}, ${rowHeight}px)`,
                    minHeight: laneMinHeight,
                    padding: "8px 0",
                    borderRadius: 8,
                    background: `repeating-linear-gradient(to right, transparent 0, transparent calc((100% / ${Math.max(1, ticks.length)}) - 1px), var(--border-secondary) calc((100% / ${Math.max(1, ticks.length)}) - 1px), var(--border-secondary) calc(100% / ${Math.max(1, ticks.length)}))`,
                    border: "1px solid var(--border-secondary)",
                    overflow: "visible",
                  }}
                >
                  {ticks.map((tick, index) => (
                    <span
                      key={`${planType}-${tick}`}
                      style={{
                        gridColumn: index + 1,
                        gridRow: `1 / ${rowCount + 1}`,
                        borderLeft: index === 0 ? "none" : "1px solid color-mix(in srgb, var(--border-secondary) 70%, transparent)",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />
                  ))}
                  {todayTickIndex !== undefined && (
                    <span
                      style={{
                        gridColumn: todayTickIndex + 1,
                        gridRow: `1 / ${rowCount + 1}`,
                        borderLeft: "2px solid color-mix(in srgb, var(--accent-blue) 50%, transparent)",
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    />
                  )}
                  {isPointLane ? ticks.map((tick, tickIndex) => {
                    const tickItems = pointItemsByTick.get(tick) || [];
                    if (tickItems.length === 0) return null;

                    return (
                      <div
                        key={`${planType}-${tick}-items`}
                        style={{
                          gridColumn: tickIndex + 1,
                          gridRow: 1,
                          alignSelf: "start",
                          justifySelf: "center",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                          maxWidth: "100%",
                          padding: "2px 4px",
                          zIndex: 2,
                        }}
                      >
                        {tickItems.map((item) => {
                          const signal = getMilestoneSignal(item.milestone, today, nextMilestoneId);
                          const tone = TONE_STYLE[signal.tone];
                          const expanded = selectedMilestoneId === item.milestone.id;
                          const chipBackground = signal.isNext
                            ? "color-mix(in srgb, var(--accent-blue-light) 76%, var(--bg-primary))"
                            : signal.isRisk
                              ? "color-mix(in srgb, var(--accent-red-light) 72%, var(--bg-primary))"
                              : signal.isDone
                                ? "color-mix(in srgb, var(--accent-green-light) 72%, var(--bg-primary))"
                                : "var(--bg-primary)";

                          return (
                            <div key={item.milestone.id} style={{ position: "relative", height: 23, display: "block", maxWidth: "100%", zIndex: expanded ? 5 : 2 }}>
                              <button
                                type="button"
                                onClick={() => onSelect(item.milestone)}
                                title={item.milestone.description || item.milestone.title}
                                style={{
                                  width: "max-content",
                                  maxWidth: 156,
                                  height: 23,
                                  borderRadius: 999,
                                  border: `1px solid ${signal.isNext ? "var(--accent-blue)" : tone.border}`,
                                  background: chipBackground,
                                  color: "var(--text-primary)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "flex-start",
                                  gap: 5,
                                  padding: "0 8px",
                                  boxShadow: signal.isNext ? "0 0 0 1px color-mix(in srgb, var(--accent-blue) 22%, transparent)" : "0 1px 0 color-mix(in srgb, var(--border-secondary) 70%, transparent)",
                                }}
                              >
                                <span style={{ color: signal.isNext ? "var(--accent-blue)" : tone.color, fontSize: 10, lineHeight: 1 }}>●</span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: signal.isNext ? 750 : 650 }}>
                                  {item.milestone.title}
                                </span>
                              </button>
                              {expanded && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "calc(100% + 4px)",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 190,
                                    maxWidth: "calc(100vw - 64px)",
                                    zIndex: 10,
                                    pointerEvents: "auto",
                                  }}
                                >
                                  <TimelineItemDetails item={item} today={today} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }) : items.map((item, index) => {
                      const signal = getMilestoneSignal(item.milestone, today, nextMilestoneId);
                      const tone = TONE_STYLE[signal.tone];
                      const startIndex = tickIndexByKey.get(getHalfMonthStart(item.start)) ?? 0;
                      const endIndex = tickIndexByKey.get(getHalfMonthStart(item.end)) ?? startIndex;
                      const stackRow = (index % rowCount) + 1;
                      const expanded = selectedMilestoneId === item.milestone.id;
                      return (
                        <div
                          key={item.milestone.id}
                          style={{
                            gridColumn: `${startIndex + 1} / ${Math.max(startIndex, endIndex) + 2}`,
                            gridRow: stackRow,
                            alignSelf: "center",
                            justifySelf: "stretch",
                            display: "grid",
                            gap: 4,
                            position: "relative",
                            zIndex: expanded ? 5 : 2,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(item.milestone)}
                            title={item.milestone.description || item.milestone.title}
                            style={{
                              width: "100%",
                              minWidth: 72,
                              height: 24,
                              borderRadius: 6,
                              border: `1px solid ${signal.isNext ? "var(--accent-blue)" : tone.border}`,
                              background: signal.isRisk ? "color-mix(in srgb, var(--accent-red-light) 55%, var(--bg-primary))" : "color-mix(in srgb, var(--accent-blue-light) 36%, var(--bg-primary))",
                              color: "var(--text-primary)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: 5,
                              padding: "0 8px",
                              boxShadow: signal.isNext ? "0 0 0 1px color-mix(in srgb, var(--accent-blue) 22%, transparent)" : "0 1px 0 color-mix(in srgb, var(--border-secondary) 70%, transparent)",
                            }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: signal.isNext ? 750 : 650 }}>
                              {item.milestone.title}
                            </span>
                            {item.scheduleNote && (
                              <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                                {item.scheduleNote}
                              </span>
                            )}
                          </button>
                          {expanded && (
                            <div
                              style={{
                                position: "absolute",
                                top: "calc(100% + 4px)",
                                left: 0,
                                width: 260,
                                maxWidth: "calc(100vw - 64px)",
                                zIndex: 10,
                                pointerEvents: "auto",
                              }}
                            >
                              <TimelineItemDetails item={item} today={today} />
                            </div>
                          )}
                        </div>
                      );
                  })}
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 10, color: "var(--text-tertiary)", fontSize: 13 }}>
            暂无已排期内容
          </div>
        )}
        {unscheduledItems.length > 0 && (
          <div style={{ display: "grid", gap: 8, paddingTop: 4 }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: 12, fontWeight: 750 }}>未排期</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {unscheduledItems.map((milestone) => {
                const signal = getMilestoneSignal(milestone, today, nextMilestoneId);
                return (
                  <button
                    key={milestone.id}
                    type="button"
                    onClick={() => onSelect(milestone)}
                    style={{
                      maxWidth: 260,
                      padding: "7px 9px",
                      borderRadius: 8,
                      border: "1px dashed var(--border-primary)",
                      background: "var(--bg-primary)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <StatusMark signal={signal} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{milestone.title}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 11, whiteSpace: "nowrap" }}>{getUnscheduledReason(milestone)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
    if (!form.stage.trim()) return "阶段不能为空";
    const dateMode = normalizeDateMode(form.dateMode, form.planType);
    if (dateMode === "range") {
      if (form.plannedStartDate && form.plannedEndDate && form.plannedStartDate > form.plannedEndDate) return "计划开始不能晚于计划结束";
      if (form.actualStartDate && form.actualEndDate && form.actualStartDate > form.actualEndDate) return "实际开始不能晚于实际结束";
      if (form.actualEndDate && !form.plannedEndDate) return "填写实际结束前请先填写计划结束";
      return "";
    }

    if (form.actualEndDate && !form.plannedEndDate) return "填写实际日期前请先填写计划日期";
    return "";
  }, []);

  const buildMilestonePayload = useCallback((form: MilestoneFormState) => {
    const sortOrderValue = Number(form.sortOrder);

    return {
      title: form.title.trim(),
      description: form.description,
      status: form.status.trim() || "planned",
      stage: form.stage.trim(),
      planType: form.planType.trim() || "milestone",
      dateMode: normalizeDateMode(form.dateMode, form.planType),
      plannedStartDate: form.plannedStartDate || null,
      plannedEndDate: form.plannedEndDate || null,
      actualStartDate: form.actualStartDate || null,
      actualEndDate: form.actualEndDate || null,
      targetDate: form.plannedEndDate || null,
      actualDate: form.actualEndDate || null,
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
    setSelectedMilestoneId(milestone.id);
    setEditingMilestoneId(milestone.id);
    setMilestoneEditError("");
    setMilestoneEditForm({
      title: milestone.title,
      description: milestone.description || "",
      status: milestone.status,
      stage: normalizeStage(milestone.stage),
      planType: milestone.planType || "milestone",
      dateMode: getMilestoneDateMode(milestone),
      plannedStartDate: toDateInputValue(milestone.plannedStartDate),
      plannedEndDate: toDateInputValue(getMilestonePlannedEnd(milestone)),
      actualStartDate: toDateInputValue(milestone.actualStartDate),
      actualEndDate: toDateInputValue(getMilestoneActualEnd(milestone)),
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

  const handleMilestoneSelect = (milestone: ProjectMilestone) => {
    if (editingMilestoneId && editingMilestoneId !== milestone.id) {
      closeMilestoneEditForm();
    }

    if (selectedMilestoneId === milestone.id) {
      if (editingMilestoneId === milestone.id) closeMilestoneEditForm();
      setSelectedMilestoneId(null);
      return;
    }

    setSelectedMilestoneId(milestone.id);
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
  const populatedStageGroups = useMemo(
    () => groupedMilestones.filter((group) => group.milestones.length > 0),
    [groupedMilestones]
  );
  const selectedMilestone = selectedMilestoneId ? milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null : null;
  const scheduleSignalCounts = useMemo(() => getScheduleSignalCounts(milestones, today), [milestones, today]);
  const nextMilestoneSignal = nextKeyMilestone ? getMilestoneSignal(nextKeyMilestone, today, nextKeyMilestone.id) : null;
  const showAllMatchedMilestones = Boolean(normalizedKeyword) || selectedPlanType !== "all" || selectedStatus !== "all";
  const hasMilestones = milestones.length > 0;

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

      {hasMilestones && (
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
                    {getPlannedDateText(nextKeyMilestone) ? ` · ${getPlannedDateText(nextKeyMilestone)}` : ""}
                    {nextKeyMilestone.owner ? ` · ${nextKeyMilestone.owner}` : ""}
                  </strong>
                  {nextMilestoneSignal && <DeviationText signal={nextMilestoneSignal} fallback="日期待定" />}
                </>
              ) : (
                <strong style={{ color: "var(--text-tertiary)", fontSize: 14 }}>暂无未完成节点</strong>
              )}
            </button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", color: "var(--text-secondary)", fontSize: 13 }}>
              <span className={scheduleSignalCounts.pointDelayed > 0 ? "entity-pill entity-pill--danger" : "entity-pill entity-pill--muted"}>节点延期 {scheduleSignalCounts.pointDelayed}</span>
              <span className={scheduleSignalCounts.rangeStartDelayed > 0 ? "entity-pill entity-pill--danger" : "entity-pill entity-pill--muted"}>晚启 {scheduleSignalCounts.rangeStartDelayed}</span>
              <span className={scheduleSignalCounts.rangeEndDelayed > 0 ? "entity-pill entity-pill--danger" : "entity-pill entity-pill--muted"}>晚结 {scheduleSignalCounts.rangeEndDelayed}</span>
              <span className="entity-pill entity-pill--success">准时 {scheduleSignalCounts.onTime}</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border-secondary)" }}>
            <div className="project-plan-toolbar-group">
              <span className="project-plan-toolbar-label">内容类型（节点 / 计划）</span>
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
            </div>
            <div style={{ display: "flex", gap: 8, flex: "1 1 360px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <div className="project-plan-toolbar-group project-plan-view-group">
                <span className="project-plan-toolbar-label">展示方式</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className={`btn ${viewMode === "list" ? "btn-primary" : "btn-secondary"}`} style={VIEW_BUTTON_STYLE} onClick={() => setViewMode("list")}>
                    列表
                  </button>
                  <button type="button" className={`btn ${viewMode === "timeline" ? "btn-primary" : "btn-secondary"}`} style={VIEW_BUTTON_STYLE} onClick={() => setViewMode("timeline")}>
                    时间轴
                  </button>
                </div>
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
      )}

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
      ) : !hasMilestones && !showMilestoneCreateForm ? (
        <div className="card empty-state project-compact-empty">
          <p>暂无关键节点，可补充里程碑、开发计划、测试计划等。</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-secondary" onClick={openMilestoneCreateForm}>
              <Icon name="plus" size={14} />
              新增节点/计划
            </button>
          </div>
        </div>
      ) : displayedMilestones.length === 0 ? (
        <div className="card empty-state">
          <p>当前筛选/查询条件下暂无项目计划与节点</p>
        </div>
      ) : viewMode === "timeline" ? (
        <TimelineView
          groups={populatedStageGroups}
          today={today}
          nextMilestoneId={nextKeyMilestone?.id}
          selectedMilestoneId={selectedMilestoneId}
          onSelect={handleMilestoneSelect}
        />
      ) : (
        <CompactPlanMatrix
          groups={populatedStageGroups}
          today={today}
          nextMilestoneId={nextKeyMilestone?.id}
          selectedMilestoneId={selectedMilestoneId}
          showAllMatched={showAllMatchedMilestones}
          onSelect={handleMilestoneSelect}
        />
      )}

      {selectedMilestone && editingMilestoneId === selectedMilestone.id ? (
        <MilestoneFormPanel
          title="编辑节点/计划"
          form={milestoneEditForm}
          setForm={setMilestoneEditForm}
          saving={milestoneEditSaving}
          error={milestoneEditError}
          onSave={() => void handleMilestoneEditSubmit(editingMilestoneId)}
          onCancel={closeMilestoneEditForm}
        />
      ) : selectedMilestone ? (
        <DetailPanel
          milestone={selectedMilestone}
          signal={getMilestoneSignal(selectedMilestone, today, nextKeyMilestone?.id)}
          deleting={deletingMilestoneId === selectedMilestone.id}
          onEdit={openMilestoneEditForm}
          onDelete={handleMilestoneDelete}
          onClose={() => setSelectedMilestoneId(null)}
        />
      ) : null}
    </section>
  );
}
