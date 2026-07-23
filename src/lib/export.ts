/**
 * Shared Markdown generation helpers for export pages and API routes.
 * Centralised here to avoid duplication between:
 *   - src/app/export/today/page.tsx
 *   - src/app/api/export/today/route.ts
 *   - src/app/export/range/page.tsx
 *   - src/app/api/export/range/route.ts
 */

import {
  HEALTH_LABELS,
  PROJECT_LINK_CATEGORIES,
  PROJECT_MILESTONE_STAGE_LABELS,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_PLAN_TYPE_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  WORK_LOG_TYPE_LABELS,
  WORK_ITEM_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  SOURCE_LABELS,
} from "@/lib/constants";
import { getMilestoneActualEnd, getMilestoneDateMode, getMilestonePlannedEnd } from "@/lib/projectMilestones";
import { excludeClosedItemsFromUpdatedItems } from "@/lib/todayBuckets";
import { formatDate, getLocalDateString } from "@/lib/utils";
import { getOptionalProjectDisplayName } from "@/lib/projectDisplay";
import type {
  ProjectSnapshotData,
  ProjectSnapshotItem,
  ProjectSnapshotLink,
  ProjectSnapshotLog,
  ProjectSnapshotMilestone,
  ProjectSnapshotMember,
  ProjectSnapshotSummary,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared sub-types (minimal shape expected by the generators)
// ---------------------------------------------------------------------------

interface LogEntry {
  id?: string;
  title: string;
  workDate: string;
  type: string;
  source: string;
  project?: string | null;
  projectRef?: { name: string } | null;
  module?: string | null;
  tags?: string | null;
  content: string;
  reportable?: boolean;
  sourceUrl?: string | null;
  item?: { id?: string; title: string } | null;
}

interface ItemEntry {
  id?: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  trackingReason?: string | null;
  sourceUrl?: string | null;
  health?: string | null;
  currentSummary?: string | null;
  nextCheckpoint?: string | null;
  reportLevel?: string | null;
  tags?: string | null;
  description?: string | null;
  closedAt?: Date | null;
  updatedAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Today export
// ---------------------------------------------------------------------------

export interface TodayExportData {
  today: string;
  workLogs: LogEntry[];
  closedItems: ItemEntry[];
  updatedItems: ItemEntry[];
  openHighPriorityItems: ItemEntry[];
  dueTodayItems: ItemEntry[];
  overdueItems: ItemEntry[];
  riskAndBlockerLogs: LogEntry[];
  decisionLogs: LogEntry[];
}

function hasText(value?: unknown) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function traceId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

function percentText(done: number, total: number) {
  if (total === 0) return "无样本";
  return `${done}/${total}`;
}

function uniqueItemCount(items: ItemEntry[]) {
  return new Set(items.map((item) => item.id || item.title)).size;
}

function renderTodayQualitySection(data: TodayExportData) {
  const {
    workLogs,
    closedItems,
    updatedItems,
    openHighPriorityItems,
    dueTodayItems,
    overdueItems,
    riskAndBlockerLogs,
    decisionLogs,
  } = data;

  const activeAttentionItems = [...openHighPriorityItems, ...dueTodayItems, ...overdueItems].filter(
    (item, index, all) => all.findIndex((candidate) => (candidate.id || candidate.title) === (item.id || item.title)) === index
  );
  const logsWithItem = workLogs.filter((log) => log.item).length;
  const logsWithSourceUrl = workLogs.filter((log) => hasText(log.sourceUrl)).length;
  const logsWithProjectOrModule = workLogs.filter(
    (log) => hasText(getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project })) || hasText(log.module)
  ).length;
  const itemsWithOwner = activeAttentionItems.filter((item) => hasText(item.owner)).length;
  const itemsWithNextAction = activeAttentionItems.filter((item) => hasText(item.nextAction)).length;
  const itemsWithDueDate = activeAttentionItems.filter((item) => hasText(item.dueDate)).length;
  const missing: string[] = [];
  const followUpReminders = openHighPriorityItems
    .filter(
      (item) =>
        !workLogs.some(
          (log) => log.item && ((item.id && log.item.id === item.id) || log.item.title === item.title)
        )
    )
    .map((item) => `P0/P1 事项「${item.title}」当日无日志，请确认是否需要跟进记录`);

  workLogs.forEach((log, index) => {
    const gaps: string[] = [];
    if (!hasText(getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project })) && !hasText(log.module)) {
      gaps.push("项目/模块");
    }
    if (!hasText(log.content)) gaps.push("内容");
    if (gaps.length > 0) missing.push(`${traceId("LOG", index)} ${log.title}: 缺少 ${gaps.join("、")}`);
  });

  activeAttentionItems.forEach((item, index) => {
    const gaps: string[] = [];
    if (!hasText(item.owner)) gaps.push("责任人");
    if (!hasText(item.nextAction)) gaps.push("下一步");
    if (!hasText(item.dueDate) && (item.priority === "P0" || item.priority === "P1" || item.status === "blocked")) gaps.push("截止日期");
    if (gaps.length > 0) missing.push(`${traceId("ATTN", index)} ${item.title}: 缺少 ${gaps.join("、")}`);
  });

  let md = `## 事实包质量检查\n\n`;
  md += `- 事实规模: 日志 ${workLogs.length} 条 | 关闭事项 ${closedItems.length} 项 | 更新事项 ${updatedItems.length} 项\n`;
  md += `- 重点覆盖: P0/P1 未关闭 ${openHighPriorityItems.length} 项 | 今日到期 ${dueTodayItems.length} 项 | 逾期 ${overdueItems.length} 项 | 风险/阻塞日志 ${riskAndBlockerLogs.length} 条 | 决策 ${decisionLogs.length} 条\n`;
  md += `- 可追溯性: 日志关联事项 ${percentText(logsWithItem, workLogs.length)} | 日志来源链接 ${percentText(logsWithSourceUrl, workLogs.length)} | 日志项目/模块 ${percentText(logsWithProjectOrModule, workLogs.length)}\n`;
  md += `- 重点事项完整性: 责任人 ${percentText(itemsWithOwner, activeAttentionItems.length)} | 下一步 ${percentText(itemsWithNextAction, activeAttentionItems.length)} | 截止日期 ${percentText(itemsWithDueDate, activeAttentionItems.length)} | 去重后重点事项 ${uniqueItemCount(activeAttentionItems)} 项\n\n`;
  md += `### 待确认信息\n\n`;
  md += missing.length > 0 ? `${missing.slice(0, 12).map((item) => `- ${item}`).join("\n")}\n\n` : `- 字段完整，未发现必填字段缺口\n\n`;
  md += `### 跟进提醒\n\n`;
  md += followUpReminders.length > 0
    ? `${followUpReminders.slice(0, 12).map((item) => `- ${item}`).join("\n")}\n\n`
    : `- 当前 P0/P1 事项均有当日关联日志\n\n`;

  return md;
}

export function generateTodayMarkdown(data: TodayExportData): string {
  const normalizedData: TodayExportData = {
    ...data,
    updatedItems: excludeClosedItemsFromUpdatedItems(data.closedItems, data.updatedItems),
  };
  const {
    today,
    workLogs,
    closedItems,
    updatedItems,
    openHighPriorityItems,
    dueTodayItems,
    overdueItems,
    riskAndBlockerLogs,
    decisionLogs,
  } = normalizedData;

  let md = `# 今日工作汇总 - ${today}\n\n`;

  // Fact package usage rules
  md += `## 日报事实包使用规则\n\n`;
  md += `- 这是今日工作事实包，只能使用下方事实整理日报表达。\n`;
  md += `- 不要补写未提供的信息，不要推断明日计划或事项结论。\n`;
  md += `- 缺失信息请标记为“待确认”。\n`;
  md += `- 可以调整措辞和结构，但所有结论必须能回溯到下方日志、事项、风险或决策。\n`;
  md += `- 风险、阻塞、逾期、P0/P1、今日决策需要优先保留。\n`;
  md += `- 外部工具不得新增事实、背景、原因或未记录的进展。\n\n`;

  md += renderTodayQualitySection(normalizedData);

  // Overview
  md += `## 概览\n\n`;
  md += `- 今日新增日志: ${workLogs.length} 条\n`;
  md += `- 今日关闭事项: ${closedItems.length} 项\n`;
  md += `- 今日更新事项: ${updatedItems.length} 项\n`;
  md += `- P0/P1 未关闭: ${openHighPriorityItems.length} 项\n`;
  md += `- 今日到期: ${dueTodayItems.length} 项\n`;
  md += `- 逾期未关闭: ${overdueItems.length} 项\n\n`;

  // 一、今日新增日志
  if (workLogs.length > 0) {
    md += `## 一、今日新增日志\n\n`;
    workLogs.forEach((log, index) => {
      md += `### [${traceId("LOG", index)}] ${log.title}\n`;
      md += `- 日期: ${log.workDate} | 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.sourceUrl) md += `- 来源链接: <${log.sourceUrl}>\n`;
      const projectName = getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project });
      if (projectName) md += `- 项目: ${projectName}`;
      if (log.module) md += ` | 模块: ${log.module}`;
      if (projectName || log.module) md += "\n";
      if (log.tags) md += `- 标签: ${log.tags}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  // 二、今日关闭事项
  if (closedItems.length > 0) {
    md += `## 二、今日关闭事项\n\n`;
    closedItems.forEach((item, index) => {
      md += `### [${traceId("CLOSED", index)}] ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.sourceUrl) md += `- 来源链接: <${item.sourceUrl}>\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
      if (item.tags) md += `- 标签: ${item.tags}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 三、今日更新事项
  if (updatedItems.length > 0) {
    md += `## 三、今日更新事项\n\n`;
    updatedItems.forEach((item, index) => {
      md += `### [${traceId("UPDATED", index)}] ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.sourceUrl) md += `- 来源链接: <${item.sourceUrl}>\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
      if (item.tags) md += `- 标签: ${item.tags}\n`;
      md += "\n";
    });
  }

  // 四、当前 P0/P1 未关闭事项
  if (openHighPriorityItems.length > 0) {
    md += `## 四、当前 P0/P1 未关闭事项\n\n`;
    openHighPriorityItems.forEach((item, index) => {
      md += `### [${traceId("P", index)}] ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
      if (item.health) md += `- 健康: ${HEALTH_LABELS[item.health] || item.health}\n`;
      if (item.sourceUrl) md += `- 来源链接: <${item.sourceUrl}>\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.dueDate) md += `- 截止日期: ${item.dueDate}\n`;
      if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
      if (item.tags) md += `- 标签: ${item.tags}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 五、今日到期事项
  if (dueTodayItems.length > 0) {
    md += `## 五、今日到期事项\n\n`;
    dueTodayItems.forEach((item, index) => {
      md += `- **[${traceId("DUE", index)}] ${item.title}** (${PRIORITY_LABELS[item.priority] || item.priority}) - ${STATUS_LABELS[item.status] || item.status}`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      if (item.sourceUrl) md += ` - 来源: <${item.sourceUrl}>`;
      md += "\n";
    });
    md += "\n";
  }

  // 六、逾期未关闭事项
  if (overdueItems.length > 0) {
    md += `## 六、逾期未关闭事项\n\n`;
    overdueItems.forEach((item, index) => {
      md += `- **[${traceId("OVERDUE", index)}] ${item.title}** - 截止: ${item.dueDate} (${PRIORITY_LABELS[item.priority] || item.priority}) - ${STATUS_LABELS[item.status] || item.status}`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      if (item.sourceUrl) md += ` - 来源: <${item.sourceUrl}>`;
      md += "\n";
    });
    md += "\n";
  }

  // 七、今日风险/阻塞
  if (riskAndBlockerLogs.length > 0) {
    md += `## 七、今日风险/阻塞\n\n`;
    riskAndBlockerLogs.forEach((log, index) => {
      md += `### [${traceId("RISK", index)}] ${log.title}\n`;
      md += `- 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.sourceUrl) md += `- 来源链接: <${log.sourceUrl}>\n`;
      const projectName = getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project });
      if (projectName) md += `- 项目: ${projectName}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  // 八、今日决策
  if (decisionLogs.length > 0) {
    md += `## 八、今日决策\n\n`;
    decisionLogs.forEach((log, index) => {
      md += `### [${traceId("DECISION", index)}] ${log.title}\n`;
      md += `- 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.sourceUrl) md += `- 来源链接: <${log.sourceUrl}>\n`;
      const projectName = getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project });
      if (projectName) md += `- 项目: ${projectName}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  return md;
}

// ---------------------------------------------------------------------------
// Range export
// ---------------------------------------------------------------------------

export interface RangeExportData {
  start: string;
  end: string;
  workLogs: LogEntry[];
  closedItems: ItemEntry[];
  updatedItems: ItemEntry[];
}

function renderRangeQualitySection(data: RangeExportData) {
  const { workLogs, closedItems, updatedItems } = data;
  const logsWithItem = workLogs.filter((log) => log.item).length;
  const logsWithSourceUrl = workLogs.filter((log) => hasText(log.sourceUrl)).length;
  const logsWithProjectOrModule = workLogs.filter(
    (log) => hasText(getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project })) || hasText(log.module)
  ).length;
  const closedWithOwner = closedItems.filter((item) => hasText(item.owner)).length;
  const updatedWithNextAction = updatedItems.filter((item) => hasText(item.nextAction)).length;
  const importantLogs = workLogs.filter((log) => ["risk", "blocker", "decision"].includes(log.type)).length;
  const missing: string[] = [];

  workLogs.forEach((log, index) => {
    const gaps: string[] = [];
    if (!hasText(getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project })) && !hasText(log.module)) {
      gaps.push("项目/模块");
    }
    if (!hasText(log.content)) gaps.push("内容");
    if (gaps.length > 0) missing.push(`${traceId("LOG", index)} ${log.title}: 缺少 ${gaps.join("、")}`);
  });

  updatedItems.forEach((item, index) => {
    const needsOwner = item.priority === "P0" || item.priority === "P1" || item.status === "blocked";
    const gaps: string[] = [];
    if (needsOwner && !hasText(item.owner)) gaps.push("责任人");
    if (needsOwner && !hasText(item.nextAction)) gaps.push("下一步");
    if (gaps.length > 0) missing.push(`${traceId("UPDATED", index)} ${item.title}: 缺少 ${gaps.join("、")}`);
  });

  let md = `## 事实包质量检查\n\n`;
  md += `- 事实规模: 日志 ${workLogs.length} 条 | 关闭事项 ${closedItems.length} 项 | 更新事项 ${updatedItems.length} 项\n`;
  md += `- 重点事实: 风险/阻塞/决策日志 ${importantLogs} 条\n`;
  md += `- 可追溯性: 日志关联事项 ${percentText(logsWithItem, workLogs.length)} | 日志来源链接 ${percentText(logsWithSourceUrl, workLogs.length)} | 日志项目/模块 ${percentText(logsWithProjectOrModule, workLogs.length)}\n`;
  md += `- 事项完整性: 关闭事项责任人 ${percentText(closedWithOwner, closedItems.length)} | 更新事项下一步 ${percentText(updatedWithNextAction, updatedItems.length)}\n\n`;
  md += `### 待确认信息\n\n`;
  md += missing.length > 0 ? `${missing.slice(0, 16).map((item) => `- ${item}`).join("\n")}\n\n` : `- 字段完整，未发现必填字段缺口\n\n`;

  return md;
}

export function generateRangeMarkdown(data: RangeExportData): string {
  const normalizedData: RangeExportData = {
    ...data,
    updatedItems: excludeClosedItemsFromUpdatedItems(data.closedItems, data.updatedItems),
  };
  const { start, end, workLogs, closedItems, updatedItems } = normalizedData;

  let md = `# 工作汇总 - ${start} 至 ${end}\n\n`;

  // Fact package usage rules
  md += `## 周报事实包使用规则\n\n`;
  md += `- 这是区间 / 周报事实包，只能使用下方事实整理周报表达。\n`;
  md += `- 不要补写未提供的信息，不要推断下周计划、关键成果或里程碑结论。\n`;
  md += `- 缺失信息请标记为“待确认”。\n`;
  md += `- 可以调整措辞和结构，但所有结论必须能回溯到下方日志、关闭事项或更新事项。\n`;
  md += `- 风险、阻塞、逾期、P0/P1、决策如在事实中出现，需要优先保留。\n`;
  md += `- 外部工具不得新增事实、背景、原因或未记录的进展。\n\n`;

  md += renderRangeQualitySection(normalizedData);

  // Summary
  md += `## 概览\n\n`;
  md += `- 日志数量: ${workLogs.length} 条\n`;
  md += `- 关闭事项: ${closedItems.length} 项\n`;
  md += `- 更新事项: ${updatedItems.length} 项\n\n`;

  // Group logs by date
  const logsByDate = workLogs.reduce((acc, log) => {
    if (!acc[log.workDate]) acc[log.workDate] = [];
    acc[log.workDate].push(log);
    return acc;
  }, {} as Record<string, LogEntry[]>);

  const dates = Object.keys(logsByDate).sort((a, b) => b.localeCompare(a));

  // 一、工作日志
  if (dates.length > 0) {
    md += `## 一、工作日志\n\n`;
    dates.forEach((date) => {
      md += `### ${date}\n\n`;
      logsByDate[date].forEach((log) => {
        const logIndex = workLogs.findIndex((candidate) => (candidate.id || candidate.title) === (log.id || log.title));
        md += `#### [${traceId("LOG", logIndex >= 0 ? logIndex : 0)}] ${log.title}\n`;
        md += `- 日期: ${log.workDate} | 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
        if (log.sourceUrl) md += `- 来源链接: <${log.sourceUrl}>\n`;
        const projectName = getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project });
        if (projectName) md += `- 项目: ${projectName}`;
        if (log.module) md += ` | 模块: ${log.module}`;
        if (projectName || log.module) md += "\n";
        if (log.tags) md += `- 标签: ${log.tags}\n`;
        if (log.item) md += `- 关联事项: ${log.item.title}\n`;
        md += `\n${log.content}\n\n`;
      });
    });
  }

  // 二、关闭事项
  if (closedItems.length > 0) {
    md += `## 二、关闭事项\n\n`;
    closedItems.forEach((item, index) => {
      md += `### [${traceId("CLOSED", index)}] ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority}\n`;
      if (item.sourceUrl) md += `- 来源链接: <${item.sourceUrl}>\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.closedAt) md += `- 关闭时间: ${item.closedAt.toISOString().split("T")[0]}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 三、更新事项
  if (updatedItems.length > 0) {
    md += `## 三、更新事项\n\n`;
    updatedItems.forEach((item, index) => {
      md += `- **[${traceId("UPDATED", index)}] ${item.title}** - ${STATUS_LABELS[item.status] || item.status} (${PRIORITY_LABELS[item.priority] || item.priority})`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      if (item.nextAction) md += ` - 下一步: ${item.nextAction}`;
      if (item.sourceUrl) md += ` - 来源: <${item.sourceUrl}>`;
      md += "\n";
    });
    md += "\n";
  }

  return md;
}

const PROJECT_LINK_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_LINK_CATEGORIES.map((category) => [category.value, category.label])
);

function normalizeMarkdownText(value?: string | null) {
  return value ? value.replace(/\r\n/g, "\n").trim() : "";
}

function escapeMarkdownInline(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/#/g, "\\#")
    .replace(/>/g, "\\>");
}

function formatSnapshotDate(value?: string | Date | null) {
  if (!value) return "-";
  return formatDate(value, "iso");
}

function renderMarkdownBlock(value?: string | null) {
  const text = normalizeMarkdownText(value);
  if (!text) return "- 暂无";

  return text
    .split("\n")
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}

function renderMarkdownList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- 暂无";
}

function renderProjectLinkLine(link: ProjectSnapshotLink) {
  const categoryLabel = PROJECT_LINK_CATEGORY_LABELS[link.category] || link.category;
  const title = escapeMarkdownInline(link.title);
  const url = link.url ? `<${link.url}>` : "-";
  const category = escapeMarkdownInline(categoryLabel);
  const meta: string[] = [];

  if (link.isPrimary) {
    meta.push("主链接");
  }

  if (link.description) {
    meta.push(escapeMarkdownInline(normalizeMarkdownText(link.description)));
  }

  const suffix = meta.length > 0 ? ` (${meta.join(" | ")})` : "";
  return `${title} [${category}] ${url}${suffix}`;
}

function renderMilestoneLine(milestone: ProjectSnapshotMilestone) {
  const planTypeLabel = PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || milestone.planType || "milestone";
  const stageLabel = milestone.stage ? PROJECT_MILESTONE_STAGE_LABELS[milestone.stage] || milestone.stage : "";
  const statusLabel = PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status;
  const dateMode = getMilestoneDateMode(milestone);
  const plannedEnd = getMilestonePlannedEnd(milestone);
  const actualEnd = getMilestoneActualEnd(milestone);
  const parts = [
    `状态 ${escapeMarkdownInline(statusLabel)}`,
    `类型 ${escapeMarkdownInline(planTypeLabel)}`,
  ];

  if (stageLabel) {
    parts.push(`阶段 ${escapeMarkdownInline(stageLabel)}`);
  }

  if (dateMode === "range") {
    const plannedRange = [milestone.plannedStartDate, plannedEnd].filter(Boolean).map((date) => formatSnapshotDate(date as string)).join(" 至 ");
    const actualRange = [milestone.actualStartDate, actualEnd].filter(Boolean).map((date) => formatSnapshotDate(date as string)).join(" 至 ");
    if (plannedRange) parts.push(`计划周期 ${plannedRange}`);
    if (actualRange) parts.push(`实际周期 ${actualRange}`);
  } else {
    if (plannedEnd) parts.push(`计划日期 ${formatSnapshotDate(plannedEnd)}`);
    if (actualEnd) parts.push(`实际日期 ${formatSnapshotDate(actualEnd)}`);
  }

  if (milestone.owner) {
    parts.push(`负责人 ${escapeMarkdownInline(milestone.owner)}`);
  }

  const title = escapeMarkdownInline(milestone.title);
  const description = milestone.description ? `\n${renderMarkdownBlock(milestone.description)}` : "";

  return `- ${title}（${parts.join(" / ")}）${description}`;
}

function renderItemLine(item: ProjectSnapshotItem) {
  const priority = item.priority ? PRIORITY_LABELS[item.priority] || item.priority : "-";
  const status = STATUS_LABELS[item.status] || item.status;
  const health = HEALTH_LABELS[item.health] || item.health;
  const parts = [
    `状态 ${escapeMarkdownInline(status)}`,
    `健康 ${escapeMarkdownInline(health)}`,
  ];

  if (item.priority) {
    parts.push(`优先级 ${escapeMarkdownInline(priority)}`);
  }

  if (item.owner) {
    parts.push(`负责人 ${escapeMarkdownInline(item.owner)}`);
  }

  if (item.dueDate) {
    parts.push(`到期 ${formatSnapshotDate(item.dueDate)}`);
  }

  if (item.nextCheckpoint) {
    parts.push(`下次检查点 ${formatSnapshotDate(item.nextCheckpoint)}`);
  }

  const title = escapeMarkdownInline(item.title);
  const lines = [`- ${title}（${parts.join(" / ")}）`];

  if (item.nextAction) {
    lines.push(renderMarkdownBlock(item.nextAction));
  } else if (item.currentSummary) {
    lines.push(renderMarkdownBlock(item.currentSummary));
  } else if (item.description) {
    lines.push(renderMarkdownBlock(item.description));
  }

  return lines.join("\n");
}

function renderLogLine(log: ProjectSnapshotLog) {
  const typeLabel = WORK_LOG_TYPE_LABELS[log.type] || log.type;
  const sourceLabel = SOURCE_LABELS[log.source] || log.source;
  const title = escapeMarkdownInline(log.title);
  const parts = [`日期 ${escapeMarkdownInline(log.workDate)}`, `类型 ${escapeMarkdownInline(typeLabel)}`, `来源 ${escapeMarkdownInline(sourceLabel)}`];

  const projectName = getOptionalProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project });
  if (projectName) {
    parts.push(`项目 ${escapeMarkdownInline(projectName)}`);
  }

  if (log.module) {
    parts.push(`模块 ${escapeMarkdownInline(log.module)}`);
  }

  if (log.item?.title) {
    parts.push(`关联事项 ${escapeMarkdownInline(log.item.title)}`);
  }

  if (log.tags) {
    parts.push(`标签 ${escapeMarkdownInline(log.tags)}`);
  }

  const content = renderMarkdownBlock(log.content);
  return `- ${title}（${parts.join(" / ")}）\n${content}`;
}

function isOpenSnapshotItem(item: ProjectSnapshotItem) {
  return item.status !== "closed";
}

function isOverdueSnapshotItem(item: ProjectSnapshotItem, today: string) {
  return Boolean(item.dueDate && item.dueDate < today && isOpenSnapshotItem(item));
}

function getSnapshotItemKey(item: ProjectSnapshotItem) {
  return item.id || item.title;
}

function countUniqueSnapshotItems(items: ProjectSnapshotItem[]) {
  return new Set(items.map(getSnapshotItemKey)).size;
}

function buildProjectSignalSummary(snapshot: ProjectSnapshotData) {
  const items = snapshot.items ?? [];
  const healthBuckets = snapshot.byHealth ?? {
    red: [],
    yellow: [],
    green: [],
    unknown: [],
  };
  const today = getLocalDateString();
  const blockedItems = items.filter((item) => item.status === "blocked");
  const p0OpenItems = items.filter((item) => isOpenSnapshotItem(item) && item.priority === "P0");
  const p1OpenItems = items.filter((item) => isOpenSnapshotItem(item) && item.priority === "P1");
  const overdueItems = items.filter((item) => isOverdueSnapshotItem(item, today));
  const topRiskItems = snapshot.topRisks ?? [];

  return {
    mustHandle: countUniqueSnapshotItems([...blockedItems, ...p0OpenItems, ...(healthBuckets.red ?? [])]),
    riskAttention: countUniqueSnapshotItems([...p1OpenItems, ...topRiskItems, ...(healthBuckets.yellow ?? [])]),
    timeRisk: countUniqueSnapshotItems(overdueItems) + (snapshot.timeline?.delayedMilestones?.length ?? 0),
    normal: countUniqueSnapshotItems(healthBuckets.green ?? []),
  };
}

function renderProjectSnapshotQualitySection(snapshot: ProjectSnapshotData) {
  const project = snapshot.project ?? null;
  const summary = snapshot.summary ?? null;
  const items = snapshot.items ?? [];
  const logs = snapshot.recentLogs ?? [];
  const milestones = snapshot.timeline?.milestones ?? snapshot.milestones ?? [];
  const members = snapshot.members ?? [];
  const links = snapshot.keyLinks?.items ?? snapshot.links ?? [];
  const activeItems = items.filter(isOpenSnapshotItem);
  const importantItems = activeItems.filter(
    (item) => item.priority === "P0" || item.priority === "P1" || item.status === "blocked" || item.health === "red"
  );
  const missing: string[] = [];
  const managementReminders: string[] = [];

  if (["active", "planning", "paused"].includes(project?.status || "") && milestones.length === 0) {
    managementReminders.push("项目尚无结构化里程碑或计划节点，请补充可跟踪的管理节点");
  }

  if (!hasText(summary?.currentSummary ?? project?.currentSummary)) missing.push("项目当前摘要待确认");
  if (!hasText(summary?.nextMilestone ?? project?.nextMilestone)) missing.push("项目下一里程碑待确认");
  if (!hasText(summary?.nextAction ?? project?.nextAction)) missing.push("项目下一动作待确认");

  importantItems.forEach((item, index) => {
    const gaps: string[] = [];
    if (!hasText(item.owner)) gaps.push("责任人");
    if (!hasText(item.nextAction) && !hasText(item.currentSummary)) gaps.push("下一步/当前摘要");
    if (!hasText(item.sourceUrl) && !hasText(item.sourceId)) gaps.push("外部来源");
    if (gaps.length > 0) missing.push(`${traceId("ITEM", index)} ${item.title}: 缺少 ${gaps.join("、")}`);
  });

  milestones.forEach((milestone, index) => {
    const gaps: string[] = [];
    if (!hasText(getMilestonePlannedEnd(milestone))) gaps.push("计划结束/计划日期");
    if (!hasText(milestone.owner)) gaps.push("负责人");
    if (gaps.length > 0) missing.push(`${traceId("MS", index)} ${milestone.title}: 缺少 ${gaps.join("、")}`);
  });

  let md = `## 事实包质量检查\n\n`;
  md += `- 事实规模: 关联事项 ${items.length} 项 | 最近日志 ${logs.length} 条 | 里程碑 ${milestones.length} 个 | 成员 ${members.length} 人 | 关键链接 ${links.length} 个\n`;
  md += `- 项目基本盘: 当前摘要 ${hasText(summary?.currentSummary ?? project?.currentSummary) ? "已填写" : "待确认"} | 下一里程碑 ${hasText(summary?.nextMilestone ?? project?.nextMilestone) ? "已填写" : "待确认"} | 下一动作 ${hasText(summary?.nextAction ?? project?.nextAction) ? "已填写" : "待确认"}\n`;
  md += `- 重点事项完整性: 责任人 ${percentText(importantItems.filter((item) => hasText(item.owner)).length, importantItems.length)} | 下一步/摘要 ${percentText(importantItems.filter((item) => hasText(item.nextAction) || hasText(item.currentSummary)).length, importantItems.length)} | 外部来源 ${percentText(importantItems.filter((item) => hasText(item.sourceUrl) || hasText(item.sourceId)).length, importantItems.length)}\n`;
  md += `- 里程碑完整性: 计划日期 ${percentText(milestones.filter((milestone) => hasText(getMilestonePlannedEnd(milestone))).length, milestones.length)} | 负责人 ${percentText(milestones.filter((milestone) => hasText(milestone.owner)).length, milestones.length)}\n\n`;
  md += `### 待确认信息\n\n`;
  md += missing.length > 0 ? `${missing.slice(0, 16).map((item) => `- ${item}`).join("\n")}\n\n` : `- 字段完整，未发现必填字段缺口\n\n`;
  md += `### 管理提醒\n\n`;
  md += managementReminders.length > 0
    ? `${managementReminders.map((item) => `- ${item}`).join("\n")}\n\n`
    : `- 当前未发现需要补充的项目结构化节点提醒\n\n`;

  return md;
}

export function generateProjectSnapshotMarkdown(snapshot: ProjectSnapshotData): string {
  const summary: ProjectSnapshotSummary | ProjectSnapshotData["project"] | null =
    snapshot.summary ?? snapshot.project ?? null;
  const project = snapshot.project ?? null;
  const projectName = summary?.name || snapshot.projectName || snapshot.projectId;
  const projectCode = summary?.code || project?.code || "";
  const signals = snapshot.signals ?? {
    itemCount: snapshot.items?.length ?? 0,
    logCount: snapshot.recentLogs?.length ?? 0,
    recentLogCount: snapshot.recentLogs?.length ?? 0,
    p0p1Count: 0,
    blockedCount: 0,
    redYellowCount: 0,
    overdueCount: 0,
    topRiskCount: snapshot.topRisks?.length ?? 0,
  };
  const healthBuckets = snapshot.byHealth ?? {
    red: [],
    yellow: [],
    green: [],
    unknown: [],
  };
  const milestoneTimeline = snapshot.timeline?.milestones ?? snapshot.milestones ?? [];
  const delayedMilestones = snapshot.timeline?.delayedMilestones ?? [];
  const nextOpenMilestone = snapshot.timeline?.nextOpenMilestone ?? null;
  const members: ProjectSnapshotMember[] = snapshot.members ?? [];
  const memberSummary = snapshot.memberSummary ?? {
    memberCount: members.length,
    coreMemberCount: members.filter((member) => member.isCore).length,
  };
  const keyLinks = snapshot.keyLinks?.items ?? snapshot.links ?? [];
  const primaryLink = snapshot.keyLinks?.primaryLink ?? keyLinks.find((link) => link.isPrimary) ?? null;
  const additionalLinkItems = primaryLink
    ? keyLinks.filter(
        (link) =>
          !(
            link.title === primaryLink.title &&
            link.url === primaryLink.url &&
            link.category === primaryLink.category
          )
      )
    : keyLinks;
  const topRisks = snapshot.topRisks ?? [];
  const recentLogs = snapshot.recentLogs ?? [];
  const nextCheckpointItem = snapshot.nextCheckpointItem ?? null;
  const coreMembers = members.filter((member) => member.isCore);
  const highlightedMembers: ProjectSnapshotMember[] = coreMembers.length > 0 ? coreMembers : members.slice(0, 6);
  const healthLines = (Object.keys(healthBuckets) as Array<keyof typeof healthBuckets>).map(
    (key) => `${HEALTH_LABELS[key] || key} ${healthBuckets[key]?.length ?? 0}`
  );
  const dateLines = [
    (summary?.startDate || project?.startDate) ? `开始 ${formatSnapshotDate(summary?.startDate || project?.startDate)}` : "",
    (summary?.targetDate || project?.targetDate) ? `目标 ${formatSnapshotDate(summary?.targetDate || project?.targetDate)}` : "",
    (summary?.releaseDate || project?.releaseDate) ? `发布 ${formatSnapshotDate(summary?.releaseDate || project?.releaseDate)}` : "",
  ].filter(Boolean) as string[];
  const signalSummary = buildProjectSignalSummary(snapshot);

  let md = `# 项目快照 - ${escapeMarkdownInline(projectName)}\n\n`;

  md += `## 项目快照事实包使用说明\n\n`;
  md += `- 这是项目快照事实包，只能根据已给事实整理，不要补写、不要推断、不要自行生成结论。\n`;
  md += `- 缺失信息请写“待确认”，不要编造背景、原因、进展或风险。\n`;
  md += `- 建议使用顺序：当前状态 -> 风险 / 阻塞 / 逾期 -> 里程碑 / 下一检查点 -> 需协调事项 -> 最近事实。\n`;
  md += `- 如果事实存在冲突，请保留冲突，不要自行裁决。\n`;
  md += `- 可以重写措辞，但不得新增事实。\n\n`;

  md += renderProjectSnapshotQualitySection(snapshot);

  md += `## 一、项目基本盘\n\n`;
  md += `- 项目: ${escapeMarkdownInline(projectName)}\n`;
  if (projectCode) {
    md += `- Code: ${escapeMarkdownInline(projectCode)}\n`;
  }
  md += `- 类型: ${escapeMarkdownInline(PROJECT_TYPE_LABELS[summary?.type || ""] || summary?.type || "-")} | 状态: ${escapeMarkdownInline(PROJECT_STATUS_LABELS[summary?.status || ""] || summary?.status || "-")} | 阶段: ${escapeMarkdownInline(PROJECT_STAGE_LABELS[summary?.stage || ""] || summary?.stage || "-")} | 健康: ${escapeMarkdownInline(HEALTH_LABELS[summary?.health || ""] || summary?.health || "-")}\n`;

  if (summary?.owner) {
    md += `- 负责人: ${escapeMarkdownInline(summary.owner)}\n`;
  }

  if (summary?.pm) {
    md += `- PM: ${escapeMarkdownInline(summary.pm)}\n`;
  }

  if (project?.sourceUrl) {
    md += `- 来源链接: <${project.sourceUrl}>\n`;
  }

  if (project?.tags) {
    md += `- 标签: ${escapeMarkdownInline(project.tags)}\n`;
  }

  if (dateLines.length > 0) {
    md += `- 日期: ${dateLines.join(" | ")}\n`;
  }

  md += `\n### 当前摘要\n\n${renderMarkdownBlock(summary?.currentSummary)}\n\n`;
  md += `### 下一里程碑\n\n${renderMarkdownBlock(summary?.nextMilestone)}\n\n`;
  md += `### 下一动作\n\n${renderMarkdownBlock(summary?.nextAction)}\n\n`;

  md += `## 二、当前状态信号\n\n`;
  md += `- 必须处理: ${signalSummary.mustHandle}\n`;
  md += `- 风险关注: ${signalSummary.riskAttention}\n`;
  md += `- 时间风险: ${signalSummary.timeRisk}\n`;
  md += `- 正常状态: ${signalSummary.normal}\n`;
  md += `- 明细口径: 关联事项 ${signals.itemCount} | 日志数 ${signals.logCount} | 最近日志 ${signals.recentLogCount} | P0/P1 ${signals.p0p1Count} | 阻塞 ${signals.blockedCount} | 逾期 ${signals.overdueCount} | Top risks ${signals.topRiskCount}\n`;
  md += `- 健康分布: ${healthLines.join(" / ")}\n\n`;

  md += `## 三、关键风险 / 阻塞 / 逾期 / 需要协调事项\n\n`;
  md += `### Top risks\n\n`;
  md += topRisks.length > 0 ? `${topRisks.map(renderItemLine).join("\n\n")}\n\n` : "- 暂无\n\n";

  md += `### 延期里程碑\n\n`;
  md += delayedMilestones.length > 0 ? `${delayedMilestones.map(renderMilestoneLine).join("\n\n")}\n\n` : "- 暂无\n\n";

  md += `## 四、里程碑与下一检查点\n\n`;
  md += `### 下一开放里程碑\n\n`;
  md += nextOpenMilestone ? `${renderMilestoneLine(nextOpenMilestone)}\n\n` : "- 暂无\n\n";

  md += `### 下一检查点事项\n\n`;
  md += nextCheckpointItem ? `${renderItemLine(nextCheckpointItem)}\n\n` : "- 暂无\n\n";

  md += `## 五、成员与关键链接\n\n`;
  md += `- 成员总数: ${memberSummary.memberCount} | 核心成员: ${memberSummary.coreMemberCount}\n\n`;

  md += `### 核心成员\n\n`;
  md +=
    renderMarkdownList(
      highlightedMembers.map((member) => {
        const bits = [escapeMarkdownInline(member.name)];
        if (member.role) bits.push(escapeMarkdownInline(member.role));
        if (member.team) bits.push(`团队 ${escapeMarkdownInline(member.team)}`);
        if (member.contact) bits.push(`联系 ${escapeMarkdownInline(member.contact)}`);
        if (member.responsibility) bits.push(escapeMarkdownInline(member.responsibility));
        return bits.join(" / ");
      })
    ) + "\n\n";

  md += `### 关键链接\n\n`;
  if (primaryLink) {
    md += `- 主链接: ${renderProjectLinkLine(primaryLink)}\n`;
  }
  if (additionalLinkItems.length > 0) {
    md += renderMarkdownList(additionalLinkItems.map(renderProjectLinkLine)) + "\n\n";
  } else if (!primaryLink) {
    md += `- 暂无\n\n`;
  } else {
    md += "\n";
  }

  md += `## 六、最近事实记录\n\n`;
  md += recentLogs.length > 0 ? `${recentLogs.map(renderLogLine).join("\n\n")}\n\n` : "- 暂无\n\n";

  md += `## 七、附录\n\n`;
  md += `- 健康卡片: ${Object.entries(healthBuckets)
    .map(([key, list]) => `${HEALTH_LABELS[key] || key} ${list.length}`)
    .join(" / ")}\n`;
  md += `- 里程碑总数: ${milestoneTimeline.length}\n`;
  md += `- 延期里程碑数: ${delayedMilestones.length}\n`;

  if (milestoneTimeline.length > 0) {
    md += `\n### 里程碑明细\n\n`;
    md += milestoneTimeline.map(renderMilestoneLine).join("\n\n") + "\n";
  }

  return md.trimEnd();
}
