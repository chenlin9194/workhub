"use client";

import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import PageLoadingState from "@/components/PageLoadingState";
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
import { buildProjectsQueryString } from "@/lib/filterLinks";
import { signalToItemsHref, signalToLogsHref } from "@/lib/signalMap";

const HEALTH_TONE: Record<string, string> = {
  green: "success",
  yellow: "warning",
  red: "danger",
  unknown: "neutral",
};

type ProjectsApiResponse = {
  projects?: Project[];
  total?: number;
};

async function readProjectsResponse(res: Response): Promise<ProjectsApiResponse> {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as ProjectsApiResponse;
  } catch (error) {
    console.error("Error parsing projects response:", error);
    return {};
  }
}

export default function ProjectsPage() {
  const router = useRouter();
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
      const params = buildProjectsQueryString({ keyword, status, health, stage }, { pageSize: 50 });
      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await readProjectsResponse(res);
      setProjects(data.projects || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, [keyword, status, health, stage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, keyword ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchProjects, keyword]);

  const handleSearch = () => {
    fetchProjects();
  };

  const exceptionCount = projects.filter((project) => {
    const signals = project.portfolioSignals;
    return project.health === "red" || project.health === "yellow" || Boolean(
      (signals?.p0p1Count || 0) + (signals?.blockedCount || 0) + (signals?.overdueCount || 0)
    );
  }).length;

  const handleProjectCardClick = (event: MouseEvent<HTMLElement>, projectId: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("a,button")) return;
    router.push(`/projects/${projectId}`);
  };

  return (
    <div className="command-list-page project-list-page">
      <div className="command-page-header">
        <div>
          <h1>项目管理</h1>
          <p>统一查看关键项目的状态、风险信号和下一步动作。</p>
          <div className="project-portfolio-summary">
            <span>{total} 个项目</span>
            <span>{exceptionCount} 个需关注</span>
          </div>
        </div>
        <div className="page-header-actions">
          <Link href="/projects/new" className="btn btn-primary">
            <Icon name="plus" size={15} />
            新建项目
          </Link>
        </div>
      </div>

      <div className="card filter-panel">
        <div className="filter-panel-label">
          <Icon name="search" size={14} />
          项目筛选
        </div>
        <div className="filter-grid">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索项目名称、代码、摘要..."
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={health} onChange={(e) => setHealth(e.target.value)}>
            <option value="">全部健康度</option>
            {HEALTH_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">全部阶段</option>
            {PROJECT_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button onClick={handleSearch} className="btn btn-secondary">
            <Icon name="search" size={15} />
            搜索
          </button>
        </div>
      </div>

      <section>
        <div className="dashboard-section-title">
          <div>
            <h2>项目列表</h2>
          </div>
          <span className="section-live">
            <i />
            {total} 个项目
          </span>
        </div>

        {loading ? (
          <PageLoadingState
            title="正在加载项目列表..."
            description="正在读取项目、状态和风险信号。"
            rows={4}
          />
        ) : projects.length === 0 ? (
          <div className="card empty-state compact-list-empty">
            <div className="empty-icon">
              <Icon name="folder" size={28} />
            </div>
            <strong>当前没有项目</strong>
            <p>点击“新建项目”开始管理项目。</p>
            <div className="empty-actions">
              <Link href="/projects/new" className="btn btn-primary">
                <Icon name="plus" size={15} />
                新建项目
              </Link>
            </div>
          </div>
        ) : (
          <div className="content-card-grid">
            {projects.map((project) => {
              const signals = project.portfolioSignals;
              const riskSignals = [
                { key: "p0p1", label: "P0/P1", value: signals?.p0p1Count ?? 0, tone: "critical", href: signalToItemsHref("p0p1", project.id) },
                { key: "blocked", label: "阻塞", value: signals?.blockedCount ?? 0, tone: "danger", href: signalToItemsHref("blocked", project.id) },
                { key: "redYellow", label: "健康红/黄", value: signals?.redYellowCount ?? 0, tone: "warning", href: signalToItemsHref("redYellow", project.id) },
                { key: "overdue", label: "逾期", value: signals?.overdueCount ?? 0, tone: "danger", href: signalToItemsHref("overdue", project.id) },
              ].filter((signal) => signal.value > 0);
              const reportableLogCount = signals?.recentReportableLogCount ?? 0;
              const nextNodeTitle = signals?.nextOpenMilestone?.title || project.nextMilestone;
              const memberCount = signals?.memberCount ?? 0;
              const coreMemberCount = signals?.coreMemberCount ?? 0;
              const hasMemberSignal = memberCount > 0 || coreMemberCount > 0;
              const hasPrimaryLink = Boolean(signals?.primaryLink);
              const hasVisibleSignal =
                riskSignals.length > 0 ||
                reportableLogCount > 0 ||
                Boolean(nextNodeTitle) ||
                hasMemberSignal ||
                hasPrimaryLink;

              return (
                <div
                  key={project.id}
                  className="card card-hover project-card"
                  role="link"
                  tabIndex={0}
                  onClick={(event) => handleProjectCardClick(event, project.id)}
                  onKeyDown={(event) => {
                    const target = event.target as HTMLElement;
                    if (event.key === "Enter" && !target.closest("a,button")) {
                      router.push(`/projects/${project.id}`);
                    }
                  }}
                >
                  <div className="project-card-layer project-card-layer--identity">
                    <div className="project-card-title-row">
                      <h3 className="project-card-title">
                        <Link
                          href={`/projects/${project.id}`}
                          className="project-card-title-link"
                        >
                          {project.name}
                          <Icon name="chevron-right" size={13} />
                        </Link>
                        {project.code && (
                          <span className="project-card-code">
                            {project.code}
                          </span>
                        )}
                      </h3>
                    </div>
                    <span
                      className={`badge badge-${HEALTH_TONE[project.health] || "neutral"} project-health-badge`}
                    >
                      {HEALTH_LABELS[project.health] || project.health}
                    </span>
                  </div>

                  <div className="project-card-layer project-card-layer--status project-card-signals">
                    <span className="project-card-meta-text">
                      {PROJECT_STATUS_LABELS[project.status] || project.status}
                    </span>
                    {project.stage && (
                      <span className="project-card-meta-text">
                        {PROJECT_STAGE_LABELS[project.stage] || project.stage}
                      </span>
                    )}
                    <span className="project-card-meta-text">
                      {PROJECT_TYPE_LABELS[project.type] || project.type}
                    </span>
                  </div>

                  <div className="project-card-layer project-card-layer--signals">
                    {hasVisibleSignal ? (
                    <div className="project-card-signals project-card-signal-row">
                      {riskSignals.map((signal) => {
                        const signalClassName = `project-signal-chip project-signal-chip--${signal.tone}`;
                        return signal.href ? (
                          <Link key={signal.key} href={signal.href} className={signalClassName}>
                            {signal.label} {signal.value}
                          </Link>
                        ) : (
                          <span key={signal.key} className={signalClassName}>
                            {signal.label} {signal.value}
                          </span>
                        );
                      })}
                      {reportableLogCount > 0 && (
                        <Link
                          href={signalToLogsHref("reportable", project.id)}
                          className="entity-pill entity-pill--muted entity-pill-link"
                        >
                          可汇报日志 {reportableLogCount}
                        </Link>
                      )}
                      {hasPrimaryLink && (
                        <span className="project-card-meta-text">
                          <Icon name="external-link" size={11} /> 主要链接
                        </span>
                      )}
                      {hasMemberSignal && (
                        <span className="project-card-meta-text">
                          核心 {coreMemberCount} / 成员 {memberCount}
                        </span>
                      )}
                    </div>
                    ) : (
                    <div className="entity-card-note project-card-quiet-note">
                      暂无明显风险信号
                    </div>
                    )}
                  </div>

                  <div className="project-card-layer project-card-layer--progress">
                    <div className="project-card-next-lines">
                      <span>
                        <Icon name="flag" size={12} /> 下一关键节点
                      </span>
                      <strong>{nextNodeTitle || "待设置"}</strong>
                    </div>
                    <div className="project-card-progress-meta">
                      {project.targetDate && <span>目标：{new Date(project.targetDate).toLocaleDateString("zh-CN")}</span>}
                      {project.owner && <span>负责人：{project.owner}</span>}
                      {project.pm && <span>PM：{project.pm}</span>}
                    </div>
                  </div>

                  <div className="project-card-footer">
                    <span>
                      <Icon name="clipboard-list" size={12} /> {project._count?.items || 0} 事项
                    </span>
                    <span>
                      <Icon name="file-text" size={12} /> {project._count?.logs || 0} 日志
                    </span>
                    <Link
                      href={`/projects/${project.id}`}
                      className="section-link"
                    >
                      进入详情 <Icon name="chevron-right" size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
