export const PROJECT_TYPES = [
  { value: "project", label: "项目" },
  { value: "version", label: "版本" },
  { value: "special", label: "专项" },
  { value: "maintenance", label: "维护" },
  { value: "other", label: "其他" },
] as const;

export const PROJECT_STATUSES = [
  { value: "active", label: "进行中" },
  { value: "planning", label: "规划中" },
  { value: "paused", label: "已暂停" },
  { value: "closed", label: "已关闭" },
  { value: "archived", label: "已归档" },
] as const;

export const PROJECT_STAGES = [
  { value: "planning", label: "规划" },
  { value: "requirement", label: "需求" },
  { value: "development", label: "开发" },
  { value: "testing", label: "测试" },
  { value: "release", label: "发布" },
  { value: "maintenance", label: "维护" },
  { value: "review", label: "复盘" },
] as const;

export const PROJECT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_TYPES.map((t) => [t.value, t.label])
);

export const PROJECT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_STATUSES.map((s) => [s.value, s.label])
);

export const PROJECT_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_STAGES.map((s) => [s.value, s.label])
);

export const PROJECT_LINK_CATEGORIES = [
  { value: "jira", label: "JIRA" },
  { value: "gerrit", label: "Gerrit" },
  { value: "jenkins", label: "Jenkins" },
  { value: "feishu", label: "飞书文档" },
  { value: "spec", label: "需求/规格" },
  { value: "test-plan", label: "测试计划" },
  { value: "release-plan", label: "发布计划" },
  { value: "dev-plan", label: "开发计划" },
  { value: "dashboard", label: "数据看板" },
  { value: "other", label: "其他" },
] as const;

export const PROJECT_MILESTONE_STATUSES = [
  { value: "planned", label: "计划中" },
  { value: "in_progress", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "delayed", label: "已延期" },
  { value: "cancelled", label: "已取消" },
] as const;

export const PROJECT_MILESTONE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_MILESTONE_STATUSES.map((status) => [status.value, status.label])
);

export const PROJECT_MILESTONE_STAGES = [
  { value: "planning", label: "规划" },
  { value: "concept", label: "概念" },
  { value: "plan", label: "计划" },
  { value: "verification", label: "开发验证" },
] as const;

export const PROJECT_MILESTONE_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_MILESTONE_STAGES.map((stage) => [stage.value, stage.label])
);

export const PROJECT_MILESTONE_DATE_MODES = [
  { value: "point", label: "时间点" },
  { value: "range", label: "时间周期" },
] as const;

export const PROJECT_MILESTONE_DATE_MODE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_MILESTONE_DATE_MODES.map((mode) => [mode.value, mode.label])
);

export const PROJECT_PLAN_TYPES = [
  { value: "milestone", label: "里程碑" },
  { value: "requirement", label: "需求计划" },
  { value: "development", label: "开发计划" },
  { value: "test", label: "测试计划" },
  { value: "release", label: "发布计划" },
  { value: "management", label: "管理节点" },
  { value: "other", label: "其他" },
] as const;

export const PROJECT_PLAN_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_PLAN_TYPES.map((type) => [type.value, type.label])
);

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

export const ACTION_ITEM_STATUSES = [
  { value: "pending", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "done", label: "已处理" },
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
  "需求",
  "变更",
  "Bug",
  "计划",
  "里程碑",
  "发布",
  "测试",
  "风险",
  "决策",
  "沟通",
  "数据",
  "其他",
] as const;

export const WORK_ITEM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WORK_ITEM_TYPES.map((t) => [t.value, t.label])
);

export const WORK_LOG_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WORK_LOG_TYPES.map((t) => [t.value, t.label])
);

export const ACTION_ITEM_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ACTION_ITEM_STATUSES.map((status) => [status.value, status.label])
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
