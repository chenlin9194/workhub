"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Icon from "@/components/Icon";
import CopyButton from "@/components/CopyButton";
import { generateProjectSnapshotMarkdown } from "@/lib/export";
import {
  HEALTH_LABELS,
  PROJECT_LINK_CATEGORIES,
  PROJECT_PLAN_TYPE_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_MILESTONE_STATUS_LABELS,
  WORK_LOG_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";
import { formatDate, getLocalDateString } from "@/lib/utils";
import type {
  ProjectSnapshotData,
  ProjectSnapshotHealthKey,
  ProjectSnapshotItem,
} from "@/lib/types";

const EMPTY_HEALTH_BUCKETS: Record<ProjectSnapshotHealthKey, ProjectSnapshotItem[]> = {
  red: [],
  yellow: [],
  green: [],
  unknown: [],
};

const LINK_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_LINK_CATEGORIES.map((category) => [category.value, category.label])
);

type MetricCardProps = {
  value: number | string;
  label: string;
  valueColor?: string;
};

function MetricCard({ value, label, valueColor }: MetricCardProps) {
  return (
    <div className="card" style={{ padding: 16, textAlign: "center" }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: valueColor || "var(--text-primary)",
          lineHeight: 1.15,
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="dashboard-section-title">
      <div>
        <span className="section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function FieldCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, wordBreak: "break-word", overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "blue";
}) {
  const toneStyles: Record<string, { color: string; background: string; border?: string }> = {
    neutral: {
      color: "var(--text-secondary)",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border-primary)",
    },
    success: {
      color: "var(--accent-green)",
      background: "var(--accent-green-light)",
      border: "1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)",
    },
    warning: {
      color: "var(--accent-orange)",
      background: "var(--accent-orange-light)",
      border: "1px solid color-mix(in srgb, var(--accent-orange) 22%, transparent)",
    },
    danger: {
      color: "var(--accent-red)",
      background: "var(--accent-red-light)",
      border: "1px solid color-mix(in srgb, var(--accent-red) 22%, transparent)",
    },
    blue: {
      color: "var(--accent-blue)",
      background: "var(--accent-blue-light)",
      border: "1px solid color-mix(in srgb, var(--accent-blue) 22%, transparent)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 650,
        color: toneStyles[tone].color,
        background: toneStyles[tone].background,
        border: toneStyles[tone].border,
      }}
    >
      {children}
    </span>
  );
}

function formatSnapshotDate(value?: string | null) {
  if (!value) return "-";
  return formatDate(value, "iso");
}

function formatListValue(value?: string | null) {
  return value ? value.trim() : "";
}

type SignalSummary = {
  mustHandle: number;
  riskAttention: number;
  timeRisk: number;
  normal: number;
};

function isOpenItem(item: ProjectSnapshotItem) {
  return item.status !== "closed";
}

function isOverdueItem(item: ProjectSnapshotItem, today: string) {
  return Boolean(item.dueDate && item.dueDate < today && isOpenItem(item));
}

function getItemKey(item: ProjectSnapshotItem) {
  return item.id || item.title;
}

function countUniqueItems(items: ProjectSnapshotItem[]) {
  return new Set(items.map(getItemKey)).size;
}

function buildSignalSummary(
  snapshot: ProjectSnapshotData,
  healthBuckets: Record<ProjectSnapshotHealthKey, ProjectSnapshotItem[]>,
  delayedMilestoneCount: number
): SignalSummary {
  const items = snapshot.items ?? [];
  const today = getLocalDateString();
  const blockedItems = items.filter((item) => item.status === "blocked");
  const p0OpenItems = items.filter((item) => isOpenItem(item) && item.priority === "P0");
  const p1OpenItems = items.filter((item) => isOpenItem(item) && item.priority === "P1");
  const overdueItems = items.filter((item) => isOverdueItem(item, today));
  const redItems = healthBuckets.red ?? [];
  const yellowItems = healthBuckets.yellow ?? [];
  const greenItems = healthBuckets.green ?? [];
  const topRiskItems = snapshot.topRisks ?? [];

  return {
    mustHandle: countUniqueItems([...blockedItems, ...p0OpenItems, ...redItems]),
    riskAttention: countUniqueItems([...p1OpenItems, ...topRiskItems, ...yellowItems]),
    timeRisk: countUniqueItems(overdueItems) + delayedMilestoneCount,
    normal: countUniqueItems(greenItems),
  };
}

export default function ProjectSnapshotPage() {
  const params = useParams();
  const projectId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [snapshot, setSnapshot] = useState<ProjectSnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError("项目 ID 无效");
      return;
    }

    const controller = new AbortController();

    async function loadSnapshot() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/projects/${projectId}/snapshot`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as ProjectSnapshotData;
        if (!controller.signal.aborted) {
          setSnapshot(data);
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error("Error fetching project snapshot:", fetchError);
          setSnapshot(null);
          setError("项目快照加载失败");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      controller.abort();
    };
  }, [projectId]);

  const markdown = snapshot ? generateProjectSnapshotMarkdown(snapshot) : "";
  const project = snapshot?.project ?? null;
  const summary = snapshot?.summary ?? project ?? null;
  const projectName = summary?.name || snapshot?.projectName || projectId || "项目快照";
  const projectCode = summary?.code || project?.code || "";
  const healthBuckets = snapshot?.byHealth ?? EMPTY_HEALTH_BUCKETS;
  const signals = snapshot?.signals;
  const memberSummary = snapshot?.memberSummary;
  const timeline = snapshot?.timeline;
  const keyLinks = snapshot?.keyLinks?.items ?? snapshot?.links ?? [];
  const primaryLink = snapshot?.keyLinks?.primaryLink ?? keyLinks.find((link) => link.isPrimary) ?? null;
  const topRisks = snapshot?.topRisks ?? [];
  const recentLogs = snapshot?.recentLogs ?? [];
  const nextCheckpointItem = snapshot?.nextCheckpointItem ?? null;
  const members = snapshot?.members ?? [];
  const coreMembers = members.filter((member) => member.isCore);
  const highlightedMembers = coreMembers.length > 0 ? coreMembers : members.slice(0, 6);
  const delayedMilestones = timeline?.delayedMilestones ?? [];
  const structuredMilestones = timeline?.milestones ?? snapshot?.milestones ?? [];
  const needsMilestoneReminder = Boolean(
    summary && ["active", "planning", "paused"].includes(summary.status) && structuredMilestones.length === 0
  );
  const nextOpenMilestone = timeline?.nextOpenMilestone ?? null;
  const signalSummary = snapshot ? buildSignalSummary(snapshot, healthBuckets, delayedMilestones.length) : null;
  const projectStatus = PROJECT_STATUS_LABELS[summary?.status || ""] || summary?.status || "-";
  const projectStage = PROJECT_STAGE_LABELS[summary?.stage || ""] || summary?.stage || "-";
  const projectType = PROJECT_TYPE_LABELS[summary?.type || ""] || summary?.type || "-";
  const projectHealthKey = summary?.health || "unknown";
  const projectHealth = HEALTH_LABELS[projectHealthKey] || projectHealthKey;
  const startDate = summary?.startDate || project?.startDate;
  const targetDate = summary?.targetDate || project?.targetDate;
  const releaseDate = summary?.releaseDate || project?.releaseDate;
  const healthCounts = (Object.entries(healthBuckets) as Array<[ProjectSnapshotHealthKey, ProjectSnapshotItem[]]>).map(
    ([key, list]) => `${HEALTH_LABELS[key] || key} ${list.length}`
  );
  const additionalLinks = keyLinks.filter(
    (link) => !primaryLink || link.id !== primaryLink.id || link.url !== primaryLink.url
  );

  const hasContent =
    Boolean(snapshot?.project) ||
    Boolean(snapshot?.summary) ||
    (snapshot?.items?.length ?? 0) > 0 ||
    (recentLogs.length > 0) ||
    (topRisks.length > 0) ||
    (members.length > 0) ||
    (snapshot?.links?.length ?? 0) > 0 ||
    (snapshot?.milestones?.length ?? 0) > 0;

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <p>快照加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <div className="empty-icon">
            <Icon name="folder" size={28} />
          </div>
          <p>{error}</p>
          <div className="empty-actions">
            <Link href={`/projects/${projectId}`} className="btn btn-secondary">
              返回项目详情
            </Link>
            <a href={`/api/projects/${projectId}/snapshot`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              打开原始 JSON
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <div className="empty-icon">
            <Icon name="folder" size={28} />
          </div>
          <p>暂无可展示的项目快照</p>
          <div className="empty-actions">
            <Link href={`/projects/${projectId}`} className="btn btn-secondary">
              返回项目详情
            </Link>
            <a href={`/api/projects/${projectId}/snapshot`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              打开原始 JSON
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="export-header">
        <div style={{ minWidth: 0 }}>
          <span className="section-eyebrow">PROJECT SNAPSHOT</span>
          <h1 style={{ wordBreak: "break-word" }}>
            {projectName}
            {projectCode && <span style={{ marginLeft: 12, fontSize: 14, color: "var(--text-tertiary)" }}>{projectCode}</span>}
          </h1>
          <p>项目快照事实包 / 可复制给外部工具继续整理成汇报材料</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <CopyButton text={markdown} label={needsMilestoneReminder ? "复制项目快照事实包（需确认）" : "复制项目快照事实包"} />
          <Link href={`/projects/${projectId}`} className="btn btn-secondary">
            <Icon name="arrow-left" size={14} />
            返回项目详情
          </Link>
          <a href={`/api/projects/${projectId}/snapshot`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <Icon name="external-link" size={14} />
            原始 JSON
          </a>
        </div>
      </section>

      <div className="card export-notice">
        <div className="export-notice-icon">i</div>
        <div style={{ minWidth: 0 }}>
          <strong>这是项目快照事实包，不是结论</strong>
          <p>页面展示的是项目快照结构化数据和 Markdown 预览，可直接复制给外部工具继续整理成汇报材料。这里也包含质量检查和待确认信息，方便你先判断事实是否够完整。</p>
          <div style={{ display: "grid", gap: 4, marginTop: 8, color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6 }}>
            <div>质量检查覆盖项目当前摘要、下一里程碑、下一动作，以及项目快照中的关键信号。</div>
            <div>重点事项会检查责任人、下一步和外部来源，里程碑会检查目标日期和负责人是否齐全。</div>
            <div>待确认信息不是错误，而是提醒你哪些事实还需要人工补齐。</div>
            <div>外部工具只能整理表达，不得补写事实或把待确认项自动补成结论。</div>
            {needsMilestoneReminder && <div>管理提醒：项目尚无结构化里程碑或计划节点，请补充可跟踪的管理节点。</div>}
          </div>
        </div>
        <span className="export-ready-tag">
          <i />
          {needsMilestoneReminder ? "可复制，需确认" : "可复制事实材料"}
        </span>
      </div>

      <section style={{ marginBottom: 24 }}>
        <SectionTitle eyebrow="OVERVIEW" title="项目概览" />
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <Chip tone={projectHealthKey === "red" ? "danger" : projectHealthKey === "yellow" ? "warning" : projectHealthKey === "green" ? "success" : "neutral"}>
              健康 {projectHealth}
            </Chip>
            <Chip tone="blue">状态 {projectStatus}</Chip>
            <Chip tone="neutral">阶段 {projectStage}</Chip>
            <Chip tone="neutral">类型 {projectType}</Chip>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <FieldCard label="负责人" value={summary?.owner || "-"} />
              <FieldCard label="PM" value={summary?.pm || "-"} />
              <FieldCard label="开始日期" value={startDate ? formatSnapshotDate(startDate) : "-"} />
              <FieldCard label="目标日期" value={targetDate ? formatSnapshotDate(targetDate) : "-"} />
              <FieldCard label="发布日期" value={releaseDate ? formatSnapshotDate(releaseDate) : "-"} />
              <FieldCard label="来源链接" value={project?.sourceUrl ? <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "underline" }}>{project.sourceUrl}</a> : "-"} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>当前摘要</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {summary?.currentSummary || "暂无当前摘要"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>下一里程碑</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {summary?.nextMilestone || "暂无下一里程碑"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>下一动作</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {summary?.nextAction || "暂无下一动作"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {project?.tags ? <Chip tone="neutral">标签 {project.tags}</Chip> : <Chip tone="neutral">标签 -</Chip>}
              {projectCode ? <Chip tone="neutral">Code {projectCode}</Chip> : null}
              <Chip tone="neutral">成员 {memberSummary?.memberCount ?? members.length}</Chip>
              <Chip tone="neutral">核心成员 {memberSummary?.coreMemberCount ?? coreMembers.length}</Chip>
              {primaryLink ? <Chip tone="blue">主链接 {primaryLink.title}</Chip> : <Chip tone="neutral">主链接 -</Chip>}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <SectionTitle eyebrow="SIGNALS" title="关键信号" />
        {signalSummary && (
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip tone="danger">必须处理 {signalSummary.mustHandle}</Chip>
              <Chip tone="warning">风险关注 {signalSummary.riskAttention}</Chip>
              <Chip tone="blue">时间风险 {signalSummary.timeRisk}</Chip>
              <Chip tone="success">正常状态 {signalSummary.normal}</Chip>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <MetricCard value={signals?.itemCount ?? snapshot?.items?.length ?? 0} label="关联事项" />
          <MetricCard value={signals?.logCount ?? recentLogs.length} label="关联日志" />
          <MetricCard value={signals?.recentLogCount ?? recentLogs.length} label="最近日志" />
          <MetricCard value={signals?.p0p1Count ?? 0} label="P0 / P1 未关闭" valueColor="var(--critical, #ef4444)" />
          <MetricCard value={signals?.blockedCount ?? 0} label="阻塞" valueColor="var(--accent-orange)" />
          <MetricCard value={signals?.overdueCount ?? 0} label="逾期" valueColor="var(--accent-red)" />
          <MetricCard value={signals?.topRiskCount ?? topRisks.length} label="Top risks" valueColor="var(--accent-red)" />
          <MetricCard value={healthCounts.join(" / ")} label="健康分布" valueColor="var(--accent-cyan)" />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <SectionTitle eyebrow="DELIVERY" title="里程碑与检查点" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>下一开放里程碑</div>
            {nextOpenMilestone ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{nextOpenMilestone.title}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Chip tone="neutral">{PROJECT_MILESTONE_STATUS_LABELS[nextOpenMilestone.status] || nextOpenMilestone.status}</Chip>
                  <Chip tone="neutral">{PROJECT_PLAN_TYPE_LABELS[nextOpenMilestone.planType || "milestone"] || nextOpenMilestone.planType}</Chip>
                  {nextOpenMilestone.targetDate && <Chip tone="blue">目标 {formatSnapshotDate(nextOpenMilestone.targetDate)}</Chip>}
                  {nextOpenMilestone.owner && <Chip tone="neutral">负责人 {nextOpenMilestone.owner}</Chip>}
                </div>
                {nextOpenMilestone.description && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {nextOpenMilestone.description}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无下一开放里程碑</div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>下一检查点事项</div>
            {nextCheckpointItem ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{nextCheckpointItem.title}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {nextCheckpointItem.priority && <Chip tone="blue">{PRIORITY_LABELS[nextCheckpointItem.priority] || nextCheckpointItem.priority}</Chip>}
                  <Chip tone="neutral">{STATUS_LABELS[nextCheckpointItem.status] || nextCheckpointItem.status}</Chip>
                  <Chip tone="neutral">{HEALTH_LABELS[nextCheckpointItem.health] || nextCheckpointItem.health}</Chip>
                  {nextCheckpointItem.owner && <Chip tone="neutral">负责人 {nextCheckpointItem.owner}</Chip>}
                  {nextCheckpointItem.nextCheckpoint && <Chip tone="blue">检查点 {formatSnapshotDate(nextCheckpointItem.nextCheckpoint)}</Chip>}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {formatListValue(nextCheckpointItem.nextAction) || formatListValue(nextCheckpointItem.currentSummary) || formatListValue(nextCheckpointItem.description) || "暂无检查点说明"}
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无下一检查点事项</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="card" style={{ padding: 18, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>延期里程碑</div>
            {delayedMilestones.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {delayedMilestones.map((milestone) => (
                  <div key={milestone.id || milestone.title} style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{milestone.title}</strong>
                      <Chip tone="danger">{PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</Chip>
                      <Chip tone="neutral">{PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || milestone.planType}</Chip>
                      {milestone.targetDate && <Chip tone="blue">目标 {formatSnapshotDate(milestone.targetDate)}</Chip>}
                      {milestone.owner && <Chip tone="neutral">负责人 {milestone.owner}</Chip>}
                    </div>
                    {milestone.description && (
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {milestone.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无延期里程碑</div>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <SectionTitle eyebrow="PEOPLE & LINKS" title="核心成员与关键链接" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
              核心成员
            </div>
            {highlightedMembers.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {highlightedMembers.map((member) => (
                  <div key={member.id || member.name} style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{member.name}</strong>
                      {member.role && <Chip tone="neutral">{member.role}</Chip>}
                      {member.isCore && <Chip tone="success">核心</Chip>}
                    </div>
                    <div style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, wordBreak: "break-word" }}>
                      <span>团队：{member.team || "-"}</span>
                      <span>联系：{member.contact || "-"}</span>
                      {member.responsibility && <span style={{ whiteSpace: "pre-wrap" }}>{member.responsibility}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无核心成员</div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
              关键链接
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {primaryLink && (
                <div style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{primaryLink.title}</strong>
                    <Chip tone="blue">主链接</Chip>
                    <Chip tone="neutral">{LINK_CATEGORY_LABELS[primaryLink.category] || primaryLink.category}</Chip>
                  </div>
                  <a
                    href={primaryLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent-blue)", textDecoration: "underline", wordBreak: "break-word", overflowWrap: "anywhere", fontSize: 13 }}
                  >
                    {primaryLink.url}
                  </a>
                </div>
              )}

              {additionalLinks.length > 0 ? (
                additionalLinks.map((link) => (
                    <div key={link.id || `${link.title}-${link.url}`} style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                        <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{link.title}</strong>
                        <Chip tone="neutral">{LINK_CATEGORY_LABELS[link.category] || link.category}</Chip>
                        {link.isPrimary && <Chip tone="success">主链接</Chip>}
                      </div>
                      {link.description && (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {link.description}
                        </div>
                      )}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--accent-blue)", textDecoration: "underline", wordBreak: "break-word", overflowWrap: "anywhere", fontSize: 13 }}
                      >
                        {link.url}
                      </a>
                    </div>
                  ))
              ) : !primaryLink ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无关键链接</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <SectionTitle eyebrow="RISK & LOG" title="Top risks 与最近日志" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Top risks</div>
            {topRisks.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {topRisks.map((risk) => (
                  <div key={risk.id || risk.title} style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{risk.title}</strong>
                      {risk.priority && <Chip tone={risk.priority === "P0" ? "danger" : risk.priority === "P1" ? "warning" : "blue"}>{PRIORITY_LABELS[risk.priority] || risk.priority}</Chip>}
                      <Chip tone={risk.status === "blocked" ? "danger" : "neutral"}>{STATUS_LABELS[risk.status] || risk.status}</Chip>
                      <Chip tone="neutral">{HEALTH_LABELS[risk.health] || risk.health}</Chip>
                    </div>
                    <div style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, wordBreak: "break-word" }}>
                      {risk.owner && <span>负责人：{risk.owner}</span>}
                      {risk.dueDate && <span>到期：{formatSnapshotDate(risk.dueDate)}</span>}
                      {(risk.nextAction || risk.currentSummary || risk.description) && (
                        <span style={{ whiteSpace: "pre-wrap" }}>{risk.nextAction || risk.currentSummary || risk.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无 Top risks</div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>最近日志</div>
            {recentLogs.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {recentLogs.map((log) => (
                  <div key={log.id || `${log.workDate}-${log.title}`} style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{log.title}</strong>
                      <Chip tone="neutral">{log.workDate}</Chip>
                      <Chip tone="neutral">{WORK_LOG_TYPE_LABELS[log.type] || log.type}</Chip>
                      <Chip tone="neutral">{log.source}</Chip>
                    </div>
                    <div style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {log.project && <span>项目：{log.project}</span>}
                      {log.module && <span>模块：{log.module}</span>}
                      {log.item?.title && <span>关联事项：{log.item.title}</span>}
                      {log.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>暂无最近日志</div>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <SectionTitle eyebrow="MARKDOWN" title="Markdown 预览" />
        <div className="card export-preview">
          <div className="export-preview-bar">
            <span>
              <i className="preview-dot red" />
              <i className="preview-dot amber" />
              <i className="preview-dot green" />
            </span>
            <span>project-snapshot.md</span>
            <span>MARKDOWN</span>
          </div>
          <pre>{markdown}</pre>
        </div>
      </section>
    </div>
  );
}
