"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import {
  PROJECT_LINK_CATEGORIES,
  PROJECT_STATUS_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_TYPE_LABELS,
  HEALTH_LABELS,
} from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import type { Project, ProjectLink } from "@/lib/types";

const HEALTH_TONE: Record<string, string> = {
  green: "success",
  yellow: "warning",
  red: "danger",
  unknown: "neutral",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState(false);

  const projectLinkCategoryLabels: Record<string, string> = Object.fromEntries(
    PROJECT_LINK_CATEGORIES.map((category) => [category.value, category.label])
  );

  const fetchProject = useCallback(async () => {
    try {
      setLinksLoading(true);
      setLinksError(false);

      const [projectRes, linksRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/links`),
      ]);

      if (projectRes.ok) {
        const data = await projectRes.json();
        setProject(data);
      }

      if (linksRes.ok) {
        const data = await linksRes.json();
        setLinks(data);
      } else {
        setLinks([]);
        setLinksError(true);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      setLinks([]);
      setLinksError(true);
    } finally {
      setLoading(false);
      setLinksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card empty-state"><p>加载中...</p></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <div className="empty-icon"><Icon name="folder" size={28} /></div>
          <p>项目不存在</p>
          <Link href="/projects" className="btn btn-secondary">返回项目列表</Link>
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
      {/* Header */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Link href="/projects" style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                <Icon name="arrow-left" size={14} /> 返回列表
              </Link>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              {project.name}
              {project.code && <span style={{ fontSize: 14, color: "var(--text-tertiary)", marginLeft: 12 }}>{project.code}</span>}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <span className={`badge badge-${HEALTH_TONE[project.health] || "neutral"}`}>
                {HEALTH_LABELS[project.health] || project.health}
              </span>
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                {PROJECT_STATUS_LABELS[project.status] || project.status}
              </span>
              {project.stage && (
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  {PROJECT_STAGE_LABELS[project.stage] || project.stage}
                </span>
              )}
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                {PROJECT_TYPE_LABELS[project.type] || project.type}
              </span>
            </div>
          </div>
          <Link href={`/projects/${project.id}/edit`} className="btn btn-secondary">
            <Icon name="edit" size={15} />
            编辑项目
          </Link>
        </div>

        {/* Summary Card */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {project.owner && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>负责人</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.owner}</div>
              </div>
            )}
            {project.pm && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>PM</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.pm}</div>
              </div>
            )}
            {project.startDate && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>开始日期</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{new Date(project.startDate).toLocaleDateString()}</div>
              </div>
            )}
            {project.targetDate && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>目标日期</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{new Date(project.targetDate).toLocaleDateString()}</div>
              </div>
            )}
            {project.releaseDate && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>发布日期</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{new Date(project.releaseDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          {project.currentSummary && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>当前摘要</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{project.currentSummary}</div>
            </div>
          )}

          {(project.nextMilestone || project.nextAction) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-primary)", display: "flex", gap: 24 }}>
              {project.nextMilestone && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下个里程碑</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.nextMilestone}</div>
                </div>
              )}
              {project.nextAction && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一步行动</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.nextAction}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{project._count?.items || 0}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>关联事项</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{project._count?.logs || 0}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>关联日志</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--critical, #ef4444)" }}>{p0p1Count}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>P0/P1</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger, #f97316)" }}>{blockedCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>阻塞</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--warning, #eab308)" }}>{redYellowCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>红/黄</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger, #f97316)" }}>{overdueCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>逾期</div>
          </div>
        </div>
      </section>

      {/* Actions */}
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

      {/* Key Links */}
      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">LINKS</span>
            <h2>关键链接</h2>
          </div>
        </div>

        {linksLoading ? (
          <div className="card empty-state">
            <p>加载中...</p>
          </div>
        ) : linksError ? (
          <div className="card empty-state">
            <p>关键链接加载失败</p>
          </div>
        ) : links.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关键链接</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {links.map((link) => (
              <div key={link.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{link.title}</strong>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                        {projectLinkCategoryLabels[link.category] || link.category}
                      </span>
                      {link.isPrimary && (
                        <span className="badge badge-success">主链接</span>
                      )}
                    </div>
                    {link.description && (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {link.description}
                      </p>
                    )}
                  </div>
                </div>

                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--accent-blue)",
                    textDecoration: "underline",
                    fontSize: 13,
                    lineHeight: 1.6,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  {link.url}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Items */}
      <section style={{ marginBottom: 24 }}>
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

      {/* Logs */}
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
