"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import ProjectHeaderSection from "@/components/ProjectHeaderSection";
import ProjectOverviewSection from "@/components/ProjectOverviewSection";
import ProjectSignalSection from "@/components/ProjectSignalSection";
import ProjectMilestoneSection from "@/components/ProjectMilestoneSection";
import ProjectLinkSection from "@/components/ProjectLinkSection";
import ProjectMemberSection from "@/components/ProjectMemberSection";
import { signalToItemsHref, signalToLogsHref } from "@/lib/signalMap";
import { SOURCE_SYSTEM_LABELS } from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import type { Project, WorkItem, WorkLog } from "@/lib/types";

const KEY_LOG_TYPES = new Set(["risk", "blocker", "decision", "update", "issue"]);

function toTime(value?: Date | string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isOpenItem(item: WorkItem) {
  return item.status !== "closed";
}

function isItemOverdue(item: WorkItem, today: string) {
  return Boolean(item.dueDate && item.dueDate < today && isOpenItem(item));
}

function getItemEvidenceRank(item: WorkItem, today: string) {
  if (!isOpenItem(item)) return 6;
  if (item.status === "blocked") return 0;
  if (isItemOverdue(item, today)) return 1;
  if (item.priority === "P0" || item.priority === "P1") return 2;
  if (item.health === "red" || item.health === "yellow") return 3;
  return 4;
}

function getItemEvidenceLabel(item: WorkItem, today: string) {
  if (item.status === "blocked") return "阻塞依据";
  if (isItemOverdue(item, today)) return "逾期依据";
  if (item.priority === "P0" || item.priority === "P1") return "高优先级";
  if (item.health === "red" || item.health === "yellow") return "风险关注";
  return undefined;
}

function getLogEvidenceRank(log: WorkLog) {
  if (log.type === "risk" || log.type === "blocker") return 0;
  if (log.type === "decision") return 1;
  if (log.type === "update" || log.type === "issue") return 2;
  if (log.reportable) return 3;
  return 4;
}

function getLogEvidenceLabel(log: WorkLog) {
  if (log.type === "risk" || log.type === "blocker") return "风险/阻塞";
  if (log.type === "decision") return "关键决策";
  if (log.type === "update" || log.type === "issue") return "关键变化";
  return undefined;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <div className="empty-icon">
            <Icon name="folder" size={28} />
          </div>
          <p>项目不存在</p>
          <Link href="/projects" className="btn btn-secondary">
            返回项目列表
          </Link>
        </div>
      </div>
    );
  }

  const items = project.items || [];
  const logs = project.logs || [];
  const p0p1Count = items.filter((i) => (i.priority === "P0" || i.priority === "P1") && i.status !== "closed").length;
  const blockedCount = items.filter((i) => i.status === "blocked").length;
  const redYellowCount = items.filter((i) => i.health === "red" || i.health === "yellow").length;
  const today = getLocalDateString();
  const overdueCount = items.filter((i) => i.dueDate && i.dueDate < today && i.status !== "closed").length;
  const attentionItems = items.filter((item) => getItemEvidenceRank(item, today) <= 3);
  const sortedItems = [...items].sort((a, b) => {
    const rankDiff = getItemEvidenceRank(a, today) - getItemEvidenceRank(b, today);
    if (rankDiff !== 0) return rankDiff;

    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return toTime(b.updatedAt) - toTime(a.updatedAt);
  });
  const keyLogCount = logs.filter((log) => KEY_LOG_TYPES.has(log.type)).length;
  const riskLogCount = logs.filter((log) => log.type === "risk").length;
  const reportableLogCount = logs.filter((log) => log.reportable).length;
  const sortedLogs = [...logs].sort((a, b) => {
    const rankDiff = getLogEvidenceRank(a) - getLogEvidenceRank(b);
    if (rankDiff !== 0) return rankDiff;

    const workDateDiff = b.workDate.localeCompare(a.workDate);
    if (workDateDiff !== 0) return workDateDiff;

    return toTime(b.createdAt) - toTime(a.createdAt);
  });

  return (
    <div className="page-shell">
      <ProjectHeaderSection project={project} />
      <ProjectOverviewSection project={project} />
      <ProjectSignalSection
        projectId={project.id}
        itemCount={project._count?.items || 0}
        logCount={project._count?.logs || 0}
        p0p1Count={p0p1Count}
        blockedCount={blockedCount}
        redYellowCount={redYellowCount}
        overdueCount={overdueCount}
      />

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/items/new?projectId=${project.id}`} className="btn btn-primary">
            <Icon name="plus" size={15} />
            新建关联事项
          </Link>
          <Link href={`/logs/new?projectId=${project.id}`} className="btn btn-secondary">
            <Icon name="edit" size={15} />
            新建关联日志
          </Link>
        </div>
      </section>

      <ProjectMilestoneSection projectId={project.id} />
      <ProjectMemberSection projectId={project.id} />
      <ProjectLinkSection projectId={project.id} />

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">PROJECT INFO</span>
            <h2>项目资料</h2>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>项目描述</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {project.description || "暂无项目描述"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>来源系统</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {project.sourceSystem ? (SOURCE_SYSTEM_LABELS[project.sourceSystem] || project.sourceSystem) : "-"}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>来源编号</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {project.sourceId || "-"}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>标签</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {project.tags || "-"}
                </div>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>来源链接</div>
              {project.sourceUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <a
                    href={project.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent-blue)", textDecoration: "underline", fontSize: 14 }}
                  >
                    打开来源链接
                  </a>
                  <div
                    style={{
                      minWidth: 0,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {project.sourceUrl}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>-</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">ITEMS</span>
            <h2>关联事项</h2>
          </div>
          <Link href={signalToItemsHref("projectItems", project.id)} className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关联事项</p>
          </div>
        ) : (
          <>
            <div
              className="card"
              style={{
                padding: 14,
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                border: attentionItems.length > 0
                  ? "1px solid color-mix(in srgb, var(--accent-orange) 28%, var(--border-primary))"
                  : "1px solid var(--border-primary)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text-primary)", marginBottom: 4 }}>
                  重点事项 {attentionItems.length} 项
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  这些事项用于解释项目阻塞、风险、逾期和高优先级状态。
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link
                  href={signalToItemsHref("blocked", project.id)}
                  style={{ display: "inline-flex", alignItems: "center", fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--accent-red-light)", color: "var(--accent-red)", textDecoration: "none" }}
                >
                  阻塞 {blockedCount}
                </Link>
                <Link
                  href={signalToItemsHref("p0p1", project.id)}
                  style={{ display: "inline-flex", alignItems: "center", fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--accent-orange-light)", color: "var(--accent-orange)", textDecoration: "none" }}
                >
                  P0/P1 {p0p1Count}
                </Link>
                <Link
                  href={signalToItemsHref("overdue", project.id)}
                  style={{ display: "inline-flex", alignItems: "center", fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--accent-red-light)", color: "var(--accent-red)", textDecoration: "none" }}
                >
                  逾期 {overdueCount}
                </Link>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>红黄 {redYellowCount}</span>
              </div>
            </div>
            <div className="content-card-grid">
              {sortedItems.slice(0, 20).map((item) => (
                <WorkItemCard key={item.id} item={item} evidenceLabel={getItemEvidenceLabel(item, today)} />
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">LOGS</span>
            <h2>最近日志</h2>
          </div>
          <Link href={signalToLogsHref("projectLogs", project.id)} className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {logs.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关联日志</p>
          </div>
        ) : (
          <>
            <div
              className="card"
              style={{
                padding: 14,
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text-primary)", marginBottom: 4 }}>
                  关键变化 {keyLogCount} 条
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  最近日志用于支撑当前摘要、风险判断和项目汇报事实。
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link href={signalToLogsHref("risk", project.id)} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--accent-red-light)", color: "var(--accent-red)", textDecoration: "none" }}>
                  风险 {riskLogCount}
                </Link>
                <Link
                  href={signalToLogsHref("reportable", project.id)}
                  style={{ display: "inline-flex", alignItems: "center", fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--accent-green-light)", color: "var(--accent-green)", textDecoration: "none" }}
                >
                  可汇报 {reportableLogCount}
                </Link>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>最近 {logs.length}</span>
              </div>
            </div>
            <div className="content-card-grid">
              {sortedLogs.slice(0, 20).map((log) => (
                <WorkLogCard key={log.id} log={log} evidenceLabel={getLogEvidenceLabel(log)} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
