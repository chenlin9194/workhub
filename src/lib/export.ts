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
  PRIORITY_LABELS,
  STATUS_LABELS,
  SOURCE_LABELS,
} from "@/lib/constants";
import { getMilestoneActualEnd, getMilestoneDateMode, getMilestonePlannedEnd } from "@/lib/projectMilestones";
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
import type { ReportAggregate, ReportActionItem, ReportLog, ReportWorkItem } from "@/lib/reportAggregator";

// Phase 4 report aggregation Markdown

function reportLogText(log: ReportLog) {
  return log.note?.trim() || log.content.trim() || log.title;
}

function renderReportLog(log: ReportLog, indent = "") {
  let md = `${indent}- ${log.workDate} · ${log.sourceKind === "actionItem" ? "行动项进展" : log.sourceKind === "project" ? "项目记录" : "事项记录"} · ${log.title}\n`;
  md += `${indent}  ${reportLogText(log).replace(/\n/g, `\n${indent}  `)}\n`;
  return md;
}

function renderReportAction(action: ReportActionItem, indent = "") {
  let md = `${indent}### ${action.title}\n`;
  md += `${indent}- 状态: ${action.status}`;
  if (action.owner) md += ` | 负责人: ${action.owner}`;
  if (action.dueDate) md += ` | 截止日期: ${action.dueDate}`;
  if (action.doneAt) md += ` | 完成日期: ${action.doneAt}`;
  md += "\n";
  if (action.logs.length > 0) {
    md += `${indent}- 进展日志:\n`;
    action.logs.forEach((log) => { md += renderReportLog(log, `${indent}  `); });
  } else if (action.latestLog) {
    md += `${indent}- 区间内无新增进展日志；最近记录: ${action.latestLog.workDate}\n`;
  }
  md += "\n";
  return md;
}

function renderReportWorkItem(item: ReportWorkItem) {
  let md = `### ${item.title}\n`;
  md += `- 状态: ${item.status} | 优先级: ${item.priority} | 健康度: ${item.health}`;
  if (item.owner) md += ` | 负责人: ${item.owner}`;
  if (item.dueDate) md += ` | 截止日期: ${item.dueDate}`;
  md += "\n";
  if (item.currentSummary) md += `- 当前摘要: ${item.currentSummary}\n`;
  if (item.nextAction) md += `- 下一步: ${item.nextAction}\n`;
  if (item.itemLogs.filter((log) => !log.isSystemLog).length > 0) {
    md += "\n事项记录:\n";
    item.itemLogs.filter((log) => !log.isSystemLog).forEach((log) => { md += renderReportLog(log, "  "); });
  }
  if (item.actionItems.length > 0) {
    md += "\n行动项:\n\n";
    item.actionItems.forEach((action) => { md += renderReportAction(action, ""); });
  }
  md += "\n";
  return md;
}

/** The Phase 4 report/export format. All report UI and export routes use this generator. */
export function generateReportMarkdown(report: ReportAggregate) {
  let md = `# 工作事实汇总 - ${report.startDate} 至 ${report.endDate}\n\n`;
  md += `> 按项目 → STR/里程碑 → 事项 → 行动项 → 日志组织；只整理已记录事实，不推断管理结论。\n\n`;
  md += `## 概览\n\n`;
  md += `- 项目: ${report.summary.projects} | STR/里程碑: ${report.summary.milestones} | 事项: ${report.summary.workItems} | 行动项: ${report.summary.actionItems} | 区间日志: ${report.summary.logs}\n`;
  if (report.summary.systemLogs > 0) md += `- 历史系统变化日志: ${report.summary.systemLogs} 条（保留在数据库，正文不展开）\n`;
  md += "\n";

  if (report.projects.length === 0) return `${md}区间内暂无已关联项目的事项、行动项或日志事实。\n`;

  for (const project of report.projects) {
    md += `## 项目：${project.name}\n\n`;
    md += `- 状态: ${project.status} | 健康度: ${project.health}`;
    if (project.owner) md += ` | 负责人: ${project.owner}`;
    if (project.pm) md += ` | PM: ${project.pm}`;
    md += "\n\n";
    if (project.projectLogs.length > 0) {
      md += "### 项目记录\n\n";
      project.projectLogs.filter((log) => !log.isSystemLog).forEach((log) => { md += renderReportLog(log); });
      md += "\n";
    }
    for (const milestone of project.milestones) {
      md += `### STR/里程碑：${milestone.title}\n\n`;
      md += `- 状态: ${milestone.status}`;
      if (milestone.targetDate) md += ` | 目标日期: ${milestone.targetDate}`;
      if (milestone.actualDate) md += ` | 实际日期: ${milestone.actualDate}`;
      if (milestone.actualEndDate) md += ` | 实际结束: ${milestone.actualEndDate}`;
      md += "\n\n";
      milestone.workItems.forEach((item) => { md += renderReportWorkItem(item); });
    }
    if (project.projectItems.length > 0) {
      md += "### 未归属 STR / 项目级事项\n\n";
      project.projectItems.forEach((item) => { md += renderReportWorkItem(item); });
    }
  }
  return md;
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
  const categoryLabel = PROJECT_LINK_CATEGORIES.find((category) => category.value === link.category)?.label || link.category;
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
