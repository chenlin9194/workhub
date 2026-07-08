import {
  PROJECT_MILESTONE_DATE_MODES,
  PROJECT_MILESTONE_STAGES,
  PROJECT_PLAN_TYPES,
} from "@/lib/constants";

export const PROJECT_MILESTONE_STAGE_VALUES: Set<string> = new Set(
  PROJECT_MILESTONE_STAGES.map((stage) => stage.value)
);

export const PROJECT_MILESTONE_DATE_MODE_VALUES: Set<string> = new Set(
  PROJECT_MILESTONE_DATE_MODES.map((mode) => mode.value)
);

export const PROJECT_PLAN_TYPE_VALUES: Set<string> = new Set(PROJECT_PLAN_TYPES.map((type) => type.value));

export const RANGE_PLAN_TYPES = new Set(["requirement", "development", "test", "release"]);

export function getDefaultDateMode(planType?: string | null) {
  return RANGE_PLAN_TYPES.has(planType || "") ? "range" : "point";
}

export function normalizePlanType(value: unknown) {
  if (typeof value !== "string") return "milestone";

  const planType = value.trim();
  return PROJECT_PLAN_TYPE_VALUES.has(planType) ? planType : "milestone";
}

export function normalizeDateMode(value: unknown, planType?: string | null) {
  if (planType && planType !== "other") {
    return getDefaultDateMode(planType);
  }

  if (typeof value === "string") {
    const dateMode = value.trim();
    if (PROJECT_MILESTONE_DATE_MODE_VALUES.has(dateMode)) return dateMode;
  }

  return getDefaultDateMode(planType);
}

export function inferLegacyMilestoneStage(milestone: { title?: string | null; description?: string | null }) {
  const source = `${milestone.description || ""} ${milestone.title || ""}`.toLowerCase();

  if (source.includes("规划阶段") || source.includes("规划ko") || source.includes("cdcp")) return "planning";
  if (source.includes("概念阶段") || source.includes("概念启动") || source.includes("str1")) return "concept";
  if (source.includes("计划阶段") || source.includes("str2") || source.includes("str3")) return "plan";
  if (source.includes("开发验证阶段") || source.includes("kick off") || source.includes("str4") || source.includes("str5")) return "verification";

  return "planning";
}

export function normalizeStage(value: unknown, fallback?: { title?: string | null; description?: string | null }) {
  if (typeof value === "string") {
    const stage = value.trim();
    if (PROJECT_MILESTONE_STAGE_VALUES.has(stage)) return stage;
  }

  return fallback ? inferLegacyMilestoneStage(fallback) : "planning";
}

export function getMilestoneStageKey(milestone: {
  stage?: string | null;
  title?: string | null;
  description?: string | null;
}) {
  return normalizeStage(milestone.stage);
}

export function getMilestoneDateMode(milestone: { dateMode?: string | null; planType?: string | null }) {
  return normalizeDateMode(milestone.dateMode, milestone.planType);
}

export function getMilestonePlannedEnd(milestone: {
  plannedEndDate?: string | Date | null;
  targetDate?: string | Date | null;
}) {
  return milestone.plannedEndDate || milestone.targetDate || null;
}

export function getMilestoneActualEnd(milestone: {
  actualEndDate?: string | Date | null;
  actualDate?: string | Date | null;
}) {
  return milestone.actualEndDate || milestone.actualDate || null;
}
