/**
 * Get local date string in YYYY-MM-DD format
 * Uses local timezone, not UTC
 */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// getTodayStr() has been removed — use getLocalDateString() instead.

/**
 * Converts empty string / undefined / null to null; otherwise returns String(value).
 * Shared helper used across API routes.
 */
export function toNullableString(value: unknown): string | null {
  return value === "" || value === undefined || value === null ? null : String(value);
}

const YMD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmdDateString(value: unknown): value is string {
  if (typeof value !== "string" || !YMD_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeOptionalYmdDateString(value: unknown): {
  value: string | null;
  error?: string;
} {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { value: null, error: "nextCheckpoint must be a valid YYYY-MM-DD date" };
  }

  if (value === "") {
    return { value: null };
  }

  if (!isValidYmdDateString(value)) {
    return { value: null, error: "nextCheckpoint must be a valid YYYY-MM-DD date" };
  }

  return { value };
}

export function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: getLocalDateString(monday),
    end: getLocalDateString(sunday),
  };
}

export function formatDate(date: string | Date, format: "short" | "full" | "iso" = "short") {
  const d = new Date(date);
  if (format === "iso") return getLocalDateString(d);
  if (format === "full") return d.toLocaleString("zh-CN");
  return d.toLocaleDateString("zh-CN");
}

export function formatTodayStr() {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
}

export function groupWorkLogs(logs: { id: string; title: string; content: string; type: string; project: string | null; module: string | null }[]) {
  const meetings = logs.filter((l) => l.type === "meeting");
  const risks = logs.filter((l) => l.type === "risk");
  const blockers = logs.filter((l) => l.type === "blocker");
  const decisions = logs.filter((l) => l.type === "decision");
  const todos = logs.filter((l) => l.type === "todo");
  const updates = logs.filter((l) => l.type === "update");
  const issues = logs.filter((l) => l.type === "issue");
  const others = logs.filter(
    (l) => !["meeting", "risk", "blocker", "decision", "todo", "update", "issue"].includes(l.type)
  );

  return [
    { title: "会议记录", items: meetings, icon: "users" },
    { title: "风险", items: risks, icon: "alert-triangle" },
    { title: "阻塞", items: blockers, icon: "shield-off" },
    { title: "决策", items: decisions, icon: "lightbulb" },
    { title: "待办", items: todos, icon: "clipboard-list" },
    { title: "更新", items: updates, icon: "refresh-cw" },
    { title: "问题跟进", items: issues, icon: "search" },
    { title: "其他记录", items: others, icon: "file-text" },
  ].filter((g) => g.items.length > 0);
}

export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === "closed") return false;
  return dueDate < getLocalDateString();
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function generateWorkItemMarkdown(item: {
  title: string;
  description?: string | null;
  project?: string | null;
  module?: string | null;
  type: string;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  tags?: string | null;
}) {
  let md = `# ${item.title}\n\n`;
  md += `**类型**: ${item.type} | **优先级**: ${item.priority} | **状态**: ${item.status}\n`;
  if (item.project) md += `**项目**: ${item.project}`;
  if (item.module) md += ` | **模块**: ${item.module}`;
  md += "\n";
  if (item.owner) md += `**责任人**: ${item.owner}\n`;
  if (item.dueDate) md += `**截止日期**: ${item.dueDate}\n`;
  if (item.description) md += `\n## 描述\n\n${item.description}\n`;
  if (item.nextAction) md += `\n## 下一步行动\n\n${item.nextAction}\n`;
  if (item.tags) md += `\n**标签**: ${item.tags}\n`;
  return md;
}

export function generateWorkLogMarkdown(log: {
  title: string;
  content: string;
  workDate: string;
  type: string;
  source: string;
  project?: string | null;
  module?: string | null;
  tags?: string | null;
}) {
  let md = `# ${log.title}\n\n`;
  md += `**日期**: ${log.workDate} | **类型**: ${log.type} | **来源**: ${log.source}\n`;
  if (log.project) md += `**项目**: ${log.project}`;
  if (log.module) md += ` | **模块**: ${log.module}`;
  md += "\n\n";
  md += `## 内容\n\n${log.content}\n`;
  if (log.tags) md += `\n**标签**: ${log.tags}\n`;
  return md;
}
