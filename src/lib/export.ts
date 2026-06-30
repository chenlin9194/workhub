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
import { formatDate } from "@/lib/utils";
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
  title: string;
  workDate: string;
  type: string;
  source: string;
  project?: string | null;
  module?: string | null;
  tags?: string | null;
  content: string;
  item?: { title: string } | null;
}

interface ItemEntry {
  title: string;
  type: string;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  tags?: string | null;
  description?: string | null;
  closedAt?: Date | null;
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

export function generateTodayMarkdown(data: TodayExportData): string {
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
  } = data;

  let md = `# 今日工作汇总 - ${today}\n\n`;

  // AI Prompt
  md += `## AI 日报提示词\n\n`;
  md += `请根据以下今日工作数据，生成一份简洁的日报。要求：\n`;
  md += `1. 总结今日主要工作成果\n`;
  md += `2. 列出关键决策和风险\n`;
  md += `3. 明日工作计划\n`;
  md += `4. 需要协调的事项\n\n`;

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
    workLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 日期: ${log.workDate} | 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}`;
      if (log.module) md += ` | 模块: ${log.module}`;
      if (log.project || log.module) md += "\n";
      if (log.tags) md += `- 标签: ${log.tags}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  // 二、今日关闭事项
  if (closedItems.length > 0) {
    md += `## 二、今日关闭事项\n\n`;
    closedItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
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
    updatedItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
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
    openHighPriorityItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority} | 状态: ${STATUS_LABELS[item.status] || item.status}\n`;
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
    dueTodayItems.forEach((item) => {
      md += `- **${item.title}** (${PRIORITY_LABELS[item.priority] || item.priority}) - ${STATUS_LABELS[item.status] || item.status}`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      md += "\n";
    });
    md += "\n";
  }

  // 六、逾期未关闭事项
  if (overdueItems.length > 0) {
    md += `## 六、逾期未关闭事项\n\n`;
    overdueItems.forEach((item) => {
      md += `- **${item.title}** - 截止: ${item.dueDate} (${PRIORITY_LABELS[item.priority] || item.priority}) - ${STATUS_LABELS[item.status] || item.status}`;
      if (item.owner) md += ` - 责任人: ${item.owner}`;
      md += "\n";
    });
    md += "\n";
  }

  // 七、今日风险/阻塞
  if (riskAndBlockerLogs.length > 0) {
    md += `## 七、今日风险/阻塞\n\n`;
    riskAndBlockerLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}\n`;
      if (log.item) md += `- 关联事项: ${log.item.title}\n`;
      md += `\n${log.content}\n\n`;
    });
  }

  // 八、今日决策
  if (decisionLogs.length > 0) {
    md += `## 八、今日决策\n\n`;
    decisionLogs.forEach((log) => {
      md += `### ${log.title}\n`;
      md += `- 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
      if (log.project) md += `- 项目: ${log.project}\n`;
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

export function generateRangeMarkdown(data: RangeExportData): string {
  const { start, end, workLogs, closedItems, updatedItems } = data;

  let md = `# 工作汇总 - ${start} 至 ${end}\n\n`;

  // AI Prompt
  md += `## AI 周报提示词\n\n`;
  md += `请根据以下本周工作数据，生成一份结构清晰的周报。要求：\n`;
  md += `1. 本周工作总结\n`;
  md += `2. 关键成果和里程碑\n`;
  md += `3. 风险和问题\n`;
  md += `4. 下周工作计划\n`;
  md += `5. 需要协调的事项\n\n`;

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
        md += `#### ${log.title}\n`;
        md += `- 日期: ${log.workDate} | 类型: ${WORK_LOG_TYPE_LABELS[log.type] || log.type} | 来源: ${SOURCE_LABELS[log.source] || log.source}\n`;
        if (log.project) md += `- 项目: ${log.project}`;
        if (log.module) md += ` | 模块: ${log.module}`;
        if (log.project || log.module) md += "\n";
        if (log.tags) md += `- 标签: ${log.tags}\n`;
        if (log.item) md += `- 关联事项: ${log.item.title}\n`;
        md += `\n${log.content}\n\n`;
      });
    });
  }

  // 二、关闭事项
  if (closedItems.length > 0) {
    md += `## 二、关闭事项\n\n`;
    closedItems.forEach((item) => {
      md += `### ${item.title}\n`;
      md += `- 类型: ${WORK_ITEM_TYPE_LABELS[item.type] || item.type} | 优先级: ${PRIORITY_LABELS[item.priority] || item.priority}\n`;
      if (item.owner) md += `- 责任人: ${item.owner}\n`;
      if (item.closedAt) md += `- 关闭时间: ${item.closedAt.toISOString().split("T")[0]}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += "\n";
    });
  }

  // 三、更新事项
  if (updatedItems.length > 0) {
    md += `## 三、更新事项\n\n`;
    updatedItems.forEach((item) => {
      md += `- **${item.title}** - ${STATUS_LABELS[item.status] || item.status} (${PRIORITY_LABELS[item.priority] || item.priority})\n`;
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

function formatSnapshotDate(value?: string | null) {
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
  const statusLabel = PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status;
  const parts = [
    `状态 ${escapeMarkdownInline(statusLabel)}`,
    `类型 ${escapeMarkdownInline(planTypeLabel)}`,
  ];

  if (milestone.targetDate) {
    parts.push(`目标 ${formatSnapshotDate(milestone.targetDate)}`);
  }

  if (milestone.actualDate) {
    parts.push(`实际 ${formatSnapshotDate(milestone.actualDate)}`);
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

  if (log.project) {
    parts.push(`项目 ${escapeMarkdownInline(log.project)}`);
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

  let md = `# 项目快照 - ${escapeMarkdownInline(projectName)}\n\n`;

  md += `## AI 汇报提示\n\n`;
  md += `- 这是项目汇报事实包，只能根据已给事实整理，不要补写、不要推断、不要生成管理结论。\n`;
  md += `- 缺失信息请写“待确认”，不要编造背景、原因、进展或风险。\n`;
  md += `- 汇报生成请优先使用：当前状态 -> 风险 / 阻塞 / 逾期 -> 里程碑 / 下一检查点 -> 需协调事项 -> 最近事实。\n`;
  md += `- 如果事实存在冲突，请保留冲突，不要自行裁决。\n`;
  md += `- 可以重写措辞，但不得新增事实。\n\n`;

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
  md += `- 关联事项: ${signals.itemCount}\n`;
  md += `- 日志数: ${signals.logCount} | 最近日志: ${signals.recentLogCount}\n`;
  md += `- P0/P1: ${signals.p0p1Count} | 阻塞: ${signals.blockedCount} | 逾期: ${signals.overdueCount} | Top risks: ${signals.topRiskCount}\n`;
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

