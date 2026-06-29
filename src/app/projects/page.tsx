"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  PROJECT_STATUSES,
  PROJECT_STAGES,
  HEALTH_OPTIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_TYPE_LABELS,
  HEALTH_LABELS,
} from "@/lib/constants";
import type { Project } from "@/lib/types";

const HEALTH_TONE: Record<string, string> = {
  green: "success",
  yellow: "warning",
  red: "danger",
  unknown: "neutral",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [health, setHealth] = useState("");
  const [stage, setStage] = useState("");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (status) params.set("status", status);
      if (health) params.set("health", health);
      if (stage) params.set("stage", stage);
      params.set("pageSize", "50");

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      setProjects(data.projects || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, [keyword, status, health, stage]);

  // Select filters fire immediately; keyword uses 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => { fetchProjects(); }, keyword ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchProjects, keyword]);

  const handleSearch = () => {
    fetchProjects();
  };

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-kicker">
            <span className="page-hero-dot" />
            PROJECT PORTFOLIO
          </div>
          <h1>项目管理</h1>
          <p className="page-hero-subtitle">
            按项目维度聚合事项、追踪健康度、生成项目快照。
          </p>
          <div className="page-hero-actions">
            <Link href="/projects/new" className="btn btn-primary">
              <Icon name="plus" size={15} />
              新建项目
            </Link>
          </div>
        </div>
      </section>

      <section className="filter-section">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜索项目名称、编码、描述..."
              style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
            >
              <option value="">全部状态</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={health}
              onChange={(e) => setHealth(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
            >
              <option value="">全部健康度</option>
              {HEALTH_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
            >
              <option value="">全部阶段</option>
              {PROJECT_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button onClick={handleSearch} className="btn btn-secondary">
              <Icon name="search" size={15} />
              搜索
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">PROJECTS</span>
            <h2>项目列表</h2>
          </div>
          <span className="section-live">
            <i />
            {total} 个项目
          </span>
        </div>

        {loading ? (
          <div className="card empty-state">
            <p>加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">
              <Icon name="folder" size={28} />
            </div>
            <p>暂无项目，点击「新建项目」开始管理项目。</p>
            <div className="empty-actions">
              <Link href="/projects/new" className="btn btn-primary">
                <Icon name="plus" size={15} />
                新建项目
              </Link>
            </div>
          </div>
        ) : (
          <div className="content-card-grid">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card project-card"
                style={{ padding: 20, textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                      {project.name}
                      {project.code && (
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>
                          {project.code}
                        </span>
                      )}
                    </h3>
                  </div>
                  <span
                    className={`badge badge-${HEALTH_TONE[project.health] || "neutral"}`}
                    style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4 }}
                  >
                    {HEALTH_LABELS[project.health] || project.health}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
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

                {project.currentSummary && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {project.currentSummary}
                  </p>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
                  {project.owner && <span>负责人: {project.owner}</span>}
                  {project.pm && <span>PM: {project.pm}</span>}
                  {project.targetDate && <span>目标: {new Date(project.targetDate).toLocaleDateString()}</span>}
                </div>

                {project.nextMilestone && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                    <Icon name="flag" size={12} /> {project.nextMilestone}
                  </div>
                )}

                <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-primary)", fontSize: 12, color: "var(--text-tertiary)" }}>
                  <span><Icon name="clipboard-list" size={12} /> {project._count?.items || 0} 事项</span>
                  <span><Icon name="file-text" size={12} /> {project._count?.logs || 0} 日志</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
