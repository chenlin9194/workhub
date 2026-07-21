"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import PageLoadingState from "@/components/PageLoadingState";
import ProjectLinkSection from "@/components/ProjectLinkSection";
import ProjectMemberSection from "@/components/ProjectMemberSection";
import ProjectMilestoneSection from "@/components/ProjectMilestoneSection";
import {
  HEALTH_LABELS,
  PRIORITY_LABELS,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_MILESTONE_STAGE_LABELS,
  PROJECT_PLAN_TYPE_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  WORK_LOG_TYPE_LABELS,
} from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import type { Project, ProjectLink, ProjectMember, ProjectMilestone, WorkItem, WorkLog } from "@/lib/types";

function toTime(value?: Date | string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function dateLabel(value?: Date | string | null) {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll("-", "/");
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replaceAll("-", "/") : "—";
}

function logTime(log: WorkLog, today: string) {
  const created = new Date(log.createdAt);
  const time = Number.isFinite(created.getTime())
    ? created.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";
  return log.workDate === today ? time : `昨 ${time}`.trim();
}

function milestonePhase(milestone: ProjectMilestone, today: string) {
  if (milestone.status === "done") return "past";
  if (milestone.status === "in_progress" || milestone.status === "delayed") return "current";
  const start = milestone.actualStartDate || milestone.plannedStartDate;
  const end = milestone.actualEndDate || milestone.actualDate || milestone.plannedEndDate || milestone.targetDate;
  const startKey = start ? new Date(start).toISOString().slice(0, 10) : null;
  const endKey = end ? new Date(end).toISOString().slice(0, 10) : null;
  if (startKey && startKey <= today && (!endKey || endKey >= today)) return "current";
  if (endKey && endKey < today) return "past";
  return "future";
}

function isRangeMilestone(milestone: ProjectMilestone) {
  return milestone.dateMode === "range" || Boolean(milestone.plannedStartDate && (milestone.plannedEndDate || milestone.targetDate));
}

function milestoneScheduleLabel(milestone: ProjectMilestone) {
  if (!isRangeMilestone(milestone)) return dateLabel(milestone.actualDate || milestone.targetDate);
  const start = milestone.actualStartDate || milestone.plannedStartDate;
  const end = milestone.actualEndDate || milestone.plannedEndDate || milestone.actualDate || milestone.targetDate;
  return `${dateLabel(start)} — ${dateLabel(end)}`;
}

function factKind(log: WorkLog) {
  if (log.type === "blocker" || log.type === "risk" || log.type === "issue") return "风险";
  if (log.type === "decision") return "决策";
  if (log.type === "update") return "变更";
  return WORK_LOG_TYPE_LABELS[log.type] || "记录";
}

export default function ProjectDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const manageModule = searchParams.get("manage");
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [milestoneView, setMilestoneView] = useState<"timeline" | "list">("timeline");

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setPanelsLoading(true);
    try {
      const projectRes = await fetch(`/api/projects/${id}`);
      if (!projectRes.ok) return;

      setProject(await projectRes.json());
      setLoading(false);

      void Promise.all([
        fetch(`/api/projects/${id}/milestones`),
        fetch(`/api/projects/${id}/links`),
        fetch(`/api/projects/${id}/members`),
      ]).then(async ([milestoneRes, linkRes, memberRes]) => {
        const [nextMilestones, nextLinks, nextMembers] = await Promise.all([
          milestoneRes.ok ? milestoneRes.json() : [],
          linkRes.ok ? linkRes.json() : [],
          memberRes.ok ? memberRes.json() : [],
        ]);
        setMilestones(nextMilestones);
        setLinks(nextLinks);
        setMembers(nextMembers);
      }).catch((error) => console.error("Error fetching project cockpit panels:", error)).finally(() => setPanelsLoading(false));
    } catch (error) {
      console.error("Error fetching project cockpit:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) return <PageLoadingState title="加载项目驾驶舱..." description="正在读取项目态势、节点和事实记录。" rows={5} />;
  if (!project) return <div className="page-shell"><div className="card empty-state"><p>项目不存在</p><Link href="/projects" className="btn btn-secondary">返回项目列表</Link></div></div>;

  if (manageModule === "milestones" || manageModule === "links" || manageModule === "members") {
    const moduleTitle = manageModule === "milestones" ? "里程碑与计划" : manageModule === "links" ? "关键链接" : "项目成员";
    return (
      <main className="page-shell project-module-management-page">
        <div className="project-module-management-head">
          <div>
            <span className="section-eyebrow">PROJECT MANAGEMENT</span>
            <h1>{project.name} · {moduleTitle}</h1>
          </div>
          <div className="project-module-management-actions">
            <Link href={`/projects/${project.id}/edit`} className="btn btn-secondary">编辑项目基本信息</Link>
            <Link href={`/projects/${project.id}`} className="btn btn-primary">返回驾驶舱</Link>
          </div>
        </div>
        {manageModule === "milestones" && <ProjectMilestoneSection projectId={project.id} />}
        {manageModule === "links" && <ProjectLinkSection projectId={project.id} />}
        {manageModule === "members" && <ProjectMemberSection projectId={project.id} />}
      </main>
    );
  }

  const today = getLocalDateString();
  const items = (project.items || []).filter((item) => item.status !== "closed");
  const logs = [...(project.logs || [])].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  const p0Count = items.filter((item) => item.priority === "P0").length;
  const p1Count = items.filter((item) => item.priority === "P1").length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  const overdueCount = items.filter((item) => Boolean(item.dueDate && item.dueDate < today)).length;
  const riskCount = items.filter((item) => item.health === "red" || item.health === "yellow").length;
  const reportableCount = logs.filter((log) => log.reportable).length;
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const cockpitItems = [...items].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.status === "blocked" && b.status !== "blocked") return -1;
    if (a.status !== "blocked" && b.status === "blocked") return 1;
    return toTime(b.updatedAt) - toTime(a.updatedAt);
  }).slice(0, 5);
  const orderedMilestones = [...milestones].sort((a, b) => (a.sortOrder - b.sortOrder) || (toTime(a.targetDate) - toTime(b.targetDate)));
  const stageMilestones = project.stage ? orderedMilestones.filter((milestone) => milestone.stage === project.stage) : [];
  const activeStageMilestones = stageMilestones.length > 0 ? stageMilestones : orderedMilestones;
  const cockpitMilestones = activeStageMilestones.slice(0, 6);
  const extraMilestones = Math.max(0, activeStageMilestones.length - cockpitMilestones.length);
  const milestonePhaseCounts = activeStageMilestones.reduce((counts, milestone) => {
    counts[milestonePhase(milestone, today)] += 1;
    return counts;
  }, { past: 0, current: 0, future: 0 });
  const stageLabel = project.stage && stageMilestones.length > 0
    ? PROJECT_MILESTONE_STAGE_LABELS[project.stage] || PROJECT_STAGE_LABELS[project.stage] || project.stage
    : PROJECT_STAGE_LABELS[project.stage || ""] || "当前阶段";
  const coreMembers = members.filter((member) => member.isCore).length;
  const todayLogCount = logs.filter((log) => log.workDate === today).length;
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const yesterdayLogCount = logs.filter((log) => log.workDate === yesterdayKey).length;

  return (
    <main className="project-cockpit-v2">
      <section className="project-cockpit-hero">
        <div className="project-cockpit-hero-main">
          <Link href="/projects" className="project-cockpit-back">← 项目列表</Link>
          <div className="project-cockpit-kicker">{project.code || "PROJECT"} · {PROJECT_STAGE_LABELS[project.stage || ""] || "阶段待定"}</div>
          <div className="project-cockpit-title-row"><h1>{project.name}</h1><Link href={`/projects/${project.id}/edit`} className="project-cockpit-edit-link"><Icon name="edit" size={13} /> 编辑项目资料</Link></div>
          <div className="project-cockpit-pills">
            <span className={`project-cockpit-pill is-${project.health}`}>健康 · {HEALTH_LABELS[project.health] || project.health}</span>
            <span className="project-cockpit-pill">{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
            <span className="project-cockpit-pill">{PROJECT_STAGE_LABELS[project.stage || ""] || "阶段待定"}</span>
            <span className="project-cockpit-signal is-critical">P0 {p0Count}</span>
            <span className="project-cockpit-signal is-warning">阻塞 {blockedCount}</span>
            <span className="project-cockpit-signal is-critical">逾期 {overdueCount}</span>
            <span className="project-cockpit-signal">P1 {p1Count}</span>
            <span className="project-cockpit-signal is-positive">可汇报 {reportableCount}</span>
          </div>
          <p className="project-cockpit-summary">{project.currentSummary || project.description || project.nextAction || "暂未补充项目进展摘要。"}</p>
        </div>
        <div className="project-cockpit-meta" aria-label="项目元信息">
          <div><span>PM</span><strong>{project.pm || "—"}</strong></div>
          <div><span>OWNER</span><strong>{project.owner || "—"}</strong></div>
          <div><span>START</span><strong>{dateLabel(project.startDate)}</strong></div>
          <div><span>TARGET</span><strong>{dateLabel(project.targetDate)}</strong></div>
          <div><span>STAGE</span><strong>{PROJECT_STAGE_LABELS[project.stage || ""] || "—"}</strong></div>
          <div><span>RELEASE</span><strong>{dateLabel(project.releaseDate)}</strong></div>
          <div><span>ITEMS</span><strong>{items.length} open</strong></div>
          <div><span>MEMBERS</span><strong>{panelsLoading ? "加载中" : `${coreMembers} core · ${members.length} total`}</strong></div>
        </div>
      </section>

      <section className="project-cockpit-panel project-cockpit-milestones">
        <div className="project-cockpit-panel-head"><div><span>PLANS & NODES</span><h2>{stageLabel}阶段计划</h2></div><div className="project-cockpit-view-switch"><button type="button" className={milestoneView === "timeline" ? "is-active" : ""} onClick={() => setMilestoneView("timeline")}>时间轴</button><button type="button" className={milestoneView === "list" ? "is-active" : ""} onClick={() => setMilestoneView("list")}>列表</button><Link href={`/projects/${project.id}?manage=milestones`} className="project-cockpit-action-link">维护计划</Link></div></div>
        {panelsLoading ? <div className="project-cockpit-panel-loading">正在读取当前阶段的里程碑与计划…</div> : <>
        <div className="project-cockpit-phase-legend"><span className="is-past">已完成 {milestonePhaseCounts.past}</span><span className="is-current">当前推进 {milestonePhaseCounts.current}</span><span className="is-future">后续计划 {milestonePhaseCounts.future}</span></div>
        {milestoneView === "timeline" ? (
          <div className="project-cockpit-axis" aria-label="里程碑时间轴">
            {cockpitMilestones.length === 0 ? <p className="project-cockpit-empty">暂无里程碑</p> : cockpitMilestones.map((milestone) => (
              <div key={milestone.id} className={`project-cockpit-axis-node is-${milestonePhase(milestone, today)}${isRangeMilestone(milestone) ? " is-range" : " is-point"}`}>
                <i /><small>{milestoneScheduleLabel(milestone)}</small><strong>{milestone.title}</strong><em><b>{isRangeMilestone(milestone) ? "周期" : "节点"}</b>{PROJECT_PLAN_TYPE_LABELS[milestone.planType] || PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</em>
              </div>
            ))}
            {extraMilestones > 0 && <Link href={`/projects/${project.id}?manage=milestones`} className="project-cockpit-more">查看本阶段其余 {extraMilestones} 项 →</Link>}
          </div>
        ) : <div className="project-cockpit-timeline">
          {cockpitMilestones.length === 0 ? <p className="project-cockpit-empty">暂无里程碑</p> : cockpitMilestones.map((milestone) => (
            <div key={milestone.id} className={`project-cockpit-node is-${milestonePhase(milestone, today)}${isRangeMilestone(milestone) ? " is-range" : " is-point"}`}><i /><div><small><b>{isRangeMilestone(milestone) ? "周期" : "节点"}</b>{milestoneScheduleLabel(milestone)} · {milestonePhase(milestone, today) === "past" ? "已完成" : milestonePhase(milestone, today) === "current" ? "当前推进" : "后续计划"}</small><strong>{milestone.title}</strong><em>{PROJECT_PLAN_TYPE_LABELS[milestone.planType] || PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</em></div></div>
          ))}
          {extraMilestones > 0 && <Link href={`/projects/${project.id}?manage=milestones`} className="project-cockpit-more">查看本阶段其余 {extraMilestones} 项 →</Link>}
        </div>}</>}
      </section>

      <section className="project-cockpit-panel project-cockpit-signals">
        <div className="project-cockpit-panel-head"><div><span>SIGNALS</span><h2>当前风险信号</h2></div></div>
        <div className="project-cockpit-signal-list">
          <div><span className="is-critical">P0 / P1</span><strong>{p0Count + p1Count}</strong><small>需优先关注事项</small></div>
          <div><span className="is-critical">阻塞</span><strong>{blockedCount}</strong><small>等待外部条件或决策</small></div>
          <div><span className="is-critical">逾期</span><strong>{overdueCount}</strong><small>超过截止日期的开放事项</small></div>
          <div><span className="is-warning">红黄风险</span><strong>{riskCount}</strong><small>健康度需跟踪</small></div>
          <div><span className="is-positive">可汇报</span><strong>{reportableCount}</strong><small>可进入项目汇报的事实</small></div>
        </div>
      </section>

      <div className="project-cockpit-right-stack">
        <section className="project-cockpit-panel project-cockpit-links">
          <div className="project-cockpit-panel-head"><div><span>KEY LINKS</span><h2>关键链接</h2></div><Link href={`/projects/${project.id}?manage=links`} className="project-cockpit-action-link">打开链接库</Link></div>
          <div className="project-cockpit-module-summary"><strong>{panelsLoading ? "正在读取链接…" : `${links.length || (project.sourceUrl ? 1 : 0)} 个已收录链接`}</strong><span>统一查看项目计划、规格和协作入口。</span></div>
        </section>
        <section className="project-cockpit-panel project-cockpit-members">
          <div className="project-cockpit-panel-head"><div><span>MEMBERS</span><h2>项目成员</h2></div><Link href={`/projects/${project.id}?manage=members`} className="project-cockpit-action-link">查看全体成员</Link></div>
          <div className="project-cockpit-module-summary"><strong>{panelsLoading ? "正在读取成员…" : `${coreMembers} 名核心成员 · ${members.length} 名成员`}</strong><span>在成员页查看角色、职责和联系方式。</span></div>
        </section>
      </div>

      <section className="project-cockpit-panel project-cockpit-items">
        <div className="project-cockpit-panel-head"><div><span>ITEMS</span><h2>本项目事项 · {items.length} open</h2></div><Link href={`/items?projectId=${project.id}`} className="project-cockpit-action-link">查看所有事项</Link></div>
        <div className="project-cockpit-item-list">
          {cockpitItems.length === 0 ? <p className="project-cockpit-empty">暂无开放事项</p> : cockpitItems.map((item: WorkItem) => <Link key={item.id} href={`/items/${item.id}`}><span className={`badge badge-${item.priority.toLowerCase()}`}>{PRIORITY_LABELS[item.priority]}</span><small className="mono">{item.sourceId || item.id.slice(-6)}</small><div><strong>{item.title}</strong><em>{item.owner || "未分配"} · {item.status === "blocked" ? "阻塞" : "跟进中"}</em></div><time className={item.dueDate && item.dueDate < today ? "is-overdue" : ""}>{dateLabel(item.dueDate)}</time></Link>)}
        </div>
      </section>

      <section className="project-cockpit-panel project-cockpit-facts">
        <div className="project-cockpit-panel-head"><div><span>FACTS</span><h2>最近事实（本项目）</h2></div><small>今日 {todayLogCount} · 昨日 {yesterdayLogCount}</small></div>
        <div className="project-cockpit-fact-list">
          {logs.slice(0, 5).map((log) => <Link key={log.id} href={`/logs/${log.id}`}><time className="mono">{logTime(log, today)}</time><span className={`project-cockpit-kind is-${log.type}`}>{factKind(log)}</span><div><strong>{log.title}</strong><em>{log.item?.title || log.module || log.source}</em></div></Link>)}
          {logs.length === 0 && <p className="project-cockpit-empty">暂无项目事实记录</p>}
        </div>
      </section>
    </main>
  );
}
