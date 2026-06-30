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
import { SOURCE_SYSTEM_LABELS } from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import type { Project } from "@/lib/types";

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

  return (
    <div className="page-shell">
      <ProjectHeaderSection project={project} />
      <ProjectOverviewSection project={project} />
      <ProjectSignalSection
        itemCount={project._count?.items || 0}
        logCount={project._count?.logs || 0}
        p0p1Count={p0p1Count}
        blockedCount={blockedCount}
        redYellowCount={redYellowCount}
        overdueCount={overdueCount}
      />

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href={`/items/new?projectId=${project.id}`} className="btn btn-primary">
            <Icon name="plus" size={15} />
            新建关联事项
          </Link>
          <Link href={`/logs/new?projectId=${project.id}`} className="btn btn-secondary">
            <Icon name="edit" size={15} />
            新建关联日志
          </Link>
          <a href={`/api/projects/${project.id}/snapshot`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <Icon name="external-link" size={15} />
            项目快照
          </a>
        </div>
      </section>

      <ProjectMilestoneSection projectId={project.id} />
      <ProjectLinkSection projectId={project.id} />
      <ProjectMemberSection projectId={project.id} />

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

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">ITEMS</span>
            <h2>关联事项</h2>
          </div>
          <Link href="/items" className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关联事项</p>
          </div>
        ) : (
          <div className="content-card-grid">
            {items.slice(0, 20).map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">LOGS</span>
            <h2>最近日志</h2>
          </div>
          <Link href="/logs" className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {logs.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关联日志</p>
          </div>
        ) : (
          <div className="content-card-grid">
            {logs.slice(0, 20).map((log) => (
              <WorkLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
