export type MilestoneView = {
  id: string;
  title: string;
  status: string;
  sortOrder?: number | null;
  targetDate?: string | Date | null;
  plannedStartDate?: string | Date | null;
  plannedEndDate?: string | Date | null;
  actualDate?: string | Date | null;
  actualStartDate?: string | Date | null;
  actualEndDate?: string | Date | null;
};

function dateKey(value?: string | Date | null) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function startKey(milestone: MilestoneView) {
  return dateKey(milestone.actualStartDate || milestone.plannedStartDate || milestone.actualDate || milestone.targetDate) || "9999-12-31";
}

function endKey(milestone: MilestoneView) {
  return dateKey(milestone.actualEndDate || milestone.actualDate || milestone.plannedEndDate || milestone.targetDate || milestone.actualStartDate || milestone.plannedStartDate) || "9999-12-31";
}

function stableOrder(a: MilestoneView, b: MilestoneView) {
  return startKey(a).localeCompare(startKey(b)) || endKey(a).localeCompare(endKey(b)) || (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title, "zh-CN") || a.id.localeCompare(b.id);
}

export function getMilestonePhase(milestone: MilestoneView, today: string) {
  if (milestone.status === "done") return "past" as const;
  if (milestone.status === "in_progress" || milestone.status === "delayed") return "current" as const;
  const start = startKey(milestone);
  const end = endKey(milestone);
  if (start !== "9999-12-31" && start <= today && end >= today) return "current" as const;
  if (end < today) return "past" as const;
  return "future" as const;
}

export function selectCurrentAndNextMilestones<T extends MilestoneView>(milestones: T[], today: string) {
  const sorted = [...milestones].sort(stableOrder);
  const current = sorted.filter((milestone) => getMilestonePhase(milestone, today) === "current")[0] || null;
  const next = sorted.filter((milestone) => getMilestonePhase(milestone, today) === "future")[0] || null;
  return { current, next };
}
