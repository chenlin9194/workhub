export const WORK_ITEM_TYPES = [
  { value: "task", label: "任务" },
  { value: "risk", label: "风险" },
  { value: "issue", label: "问题" },
  { value: "decision", label: "决策" },
  { value: "blocker", label: "阻塞" },
  { value: "other", label: "其他" },
] as const;

export const WORK_LOG_TYPES = [
  { value: "note", label: "笔记" },
  { value: "meeting", label: "会议" },
  { value: "update", label: "更新" },
  { value: "risk", label: "风险" },
  { value: "decision", label: "决策" },
  { value: "todo", label: "待办" },
  { value: "feishu", label: "飞书" },
  { value: "issue", label: "问题" },
  { value: "blocker", label: "阻塞" },
  { value: "other", label: "其他" },
] as const;

export const PRIORITIES = [
  { value: "P0", label: "P0 - 紧急" },
  { value: "P1", label: "P1 - 高" },
  { value: "P2", label: "P2 - 中" },
  { value: "P3", label: "P3 - 低" },
] as const;

export const STATUSES = [
  { value: "open", label: "待处理" },
  { value: "following", label: "跟进中" },
  { value: "blocked", label: "已阻塞" },
  { value: "closed", label: "已关闭" },
] as const;

export const SOURCES = [
  { value: "manual", label: "手动" },
  { value: "meeting", label: "会议" },
  { value: "feishu", label: "飞书" },
  { value: "phone", label: "电话" },
  { value: "mail", label: "邮件" },
  { value: "other", label: "其他" },
] as const;

export const MODULES = [
  "Camera",
  "Telephony",
  "OTA",
  "Power",
  "Stability",
  "Launcher",
  "Framework",
  "Other",
] as const;

export const WORK_ITEM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WORK_ITEM_TYPES.map((t) => [t.value, t.label])
);

export const WORK_LOG_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WORK_LOG_TYPES.map((t) => [t.value, t.label])
);

export const PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.label])
);

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label])
);

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCES.map((s) => [s.value, s.label])
);

// Legacy aliases for backward compatibility
export const NOTE_TYPES = WORK_LOG_TYPES;
export const TYPE_LABELS = WORK_LOG_TYPE_LABELS;
