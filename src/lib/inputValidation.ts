import {
  HEALTH_OPTIONS,
  ACTION_ITEM_STATUSES,
  PRIORITIES,
  REPORT_LEVEL_OPTIONS,
  SOURCES,
  STATUSES,
  WORK_ITEM_TYPES,
  WORK_LOG_TYPES,
} from "@/lib/constants";
import { isValidYmdDateString } from "@/lib/utils";

type Option = { value: string };
type ValidationResult<T> = { value: T; error?: string };

function optionValues(options: readonly Option[]) {
  return new Set(options.map((option) => option.value));
}

export const WORK_ITEM_TYPE_VALUES = optionValues(WORK_ITEM_TYPES);
export const PRIORITY_VALUES = optionValues(PRIORITIES);
export const STATUS_VALUES = optionValues(STATUSES);
export const HEALTH_VALUES = optionValues(HEALTH_OPTIONS);
export const REPORT_LEVEL_VALUES = optionValues(REPORT_LEVEL_OPTIONS);
export const WORK_LOG_TYPE_VALUES = optionValues(WORK_LOG_TYPES);
export const LOG_SOURCE_VALUES = optionValues(SOURCES);
export const ACTION_ITEM_STATUS_VALUES = optionValues(ACTION_ITEM_STATUSES);

export function requireText(value: unknown, label: string): ValidationResult<string> {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? { value: normalized } : { value: "", error: `${label}不能为空` };
}

export function requireEnum(value: unknown, values: Set<string>, field: string): ValidationResult<string> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return { value: "", error: `${field}不能为空` };
  if (!values.has(normalized)) return { value: "", error: `${field}无效` };
  return { value: normalized };
}

export function enumOrDefault(value: unknown, values: Set<string>, field: string, fallback: string): ValidationResult<string> {
  if (value === undefined || value === null || value === "") return { value: fallback };
  return requireEnum(value, values, field);
}

export function optionalYmdDate(value: unknown, field: string): ValidationResult<string | null> {
  if (value === undefined || value === null || value === "") return { value: null as string | null };
  if (typeof value !== "string" || !isValidYmdDateString(value)) {
    return { value: null as string | null, error: `${field}必须是 YYYY-MM-DD 日期` };
  }
  return { value };
}

export function normalizePage(value: string | null, fallback = 1, max = 100) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
}
