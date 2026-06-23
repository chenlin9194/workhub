export const WORK_ITEM_TYPES = [
  { value: "requirement", label: "需求" },
  { value: "milestone", label: "里程碑" },
  { value: "commitment", label: "承诺项" },
  { value: "action", label: "推进动作" },
  { value: "change", label: "变更" },
  { value: "risk", label: "风险" },
  { value: "issue", label: "问题" },
  { value: "decision", label: "决策" },
  { value: "blocker", label: "阻塞" },
  { value: "other", label: "其他" },
] as const;

export const HEALTH_OPTIONS = [
  { value: "unknown", label: "未知" },
  { value: "green", label: "正常" },
  { value: "yellow", label: "关注" },
  { value: "red", label: "风险" },
] as const;

export const REPORT_LEVEL_OPTIONS = [
  { value: "none", label: "不进入汇报" },
  { value: "daily", label: "日报" },
  { value: "weekly", label: "周报" },
  { value: "project", label: "项目汇报" },
  { value: "management", label: "管理汇报" },
] as const;

export const SOURCE_SYSTEM_OPTIONS = [
  { value: "manual", label: "手动" },
  { value: "meeting", label: "会议" },
  { value: "mail", label: "邮件" },
  { value: "feishu", label: "飞书" },
  { value: "jira", label: "JIRA" },
  { value: "alm", label: "ALM" },
  { value: "gerrit", label: "Gerrit" },
  { value: "jenkins", label: "Jenkins" },
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

export const HEALTH_LABELS: Record<string, string> = Object.fromEntries(
  HEALTH_OPTIONS.map((option) => [option.value, option.label])
);

export const REPORT_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_LEVEL_OPTIONS.map((option) => [option.value, option.label])
);

export const SOURCE_SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_SYSTEM_OPTIONS.map((option) => [option.value, option.label])
);
