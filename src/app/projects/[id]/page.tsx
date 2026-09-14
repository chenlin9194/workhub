"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import PageLoadingState from "@/components/PageLoadingState";
import ProjectLinkSection from "@/components/ProjectLinkSection";
import ProjectMemberSection from "@/components/ProjectMemberSection";
import ProjectMilestoneSection from "@/components/ProjectMilestoneSection";
import ProjectWbsSummarySection from "@/components/ProjectWbsSummarySection";
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
import { selectCurrentAndNextMilestones } from "@/lib/projectMilestoneView";

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

function milestoneDateTime(value?: Date | string | null) {
  const time = toTime(value);
  return time > 0 ? time : Number.POSITIVE_INFINITY;
}

function getMilestoneSortStart(milestone: ProjectMilestone) {
  return milestoneDateTime(
    milestone.actualStartDate ||
      milestone.plannedStartDate ||
      milestone.actualDate ||
      milestone.targetDate ||
      milestone.actualEndDate ||
      milestone.plannedEndDate,
  );
}

function getMilestoneSortEnd(milestone: ProjectMilestone) {
  return milestoneDateTime(
    milestone.actualEndDate ||
      milestone.actualDate ||
      milestone.plannedEndDate ||
      milestone.targetDate ||
      milestone.actualStartDate ||
      milestone.plannedStartDate,
  );
}

function compareMilestonesByStart(a: ProjectMilestone, b: ProjectMilestone) {
  return (getMilestoneSortStart(a) - getMilestoneSortStart(b)) ||
    (getMilestoneSortEnd(a) - getMilestoneSortEnd(b)) ||
    (a.sortOrder - b.sortOrder) ||
    a.title.localeCompare(b.title, "zh-CN");
}

function comparePastMilestones(a: ProjectMilestone, b: ProjectMilestone) {
  return (getMilestoneSortEnd(b) - getMilestoneSortEnd(a)) ||
    (getMilestoneSortStart(b) - getMilestoneSortStart(a)) ||
    (a.sortOrder - b.sortOrder) ||
    a.title.localeCompare(b.title, "zh-CN");
}

function selectCockpitMilestones(milestones: ProjectMilestone[], today: string) {
  const current = milestones
    .filter((milestone) => milestonePhase(milestone, today) === "current")
    .sort(compareMilestonesByStart);
  const future = milestones
    .filter((milestone) => milestonePhase(milestone, today) === "future")
    .sort(compareMilestonesByStart);
  const past = milestones
    .filter((milestone) => milestonePhase(milestone, today) === "past")
    .sort(comparePastMilestones);

  if (current.length === 0 && future.length === 0) {
    return past.slice(0, 6).sort(compareMilestonesByStart);
  }

  const selected = [...current.slice(0, 6)];
  let remaining = 6 - selected.length;
  if (remaining > 0) {
    selected.push(...future.slice(0, remaining));
    remaining = 6 - selected.length;
  }
  if (remaining > 0 && past.length > 0) {
    selected.push(past[0]);
  }

  return selected.sort(compareMilestonesByStart);
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
  const actionInFlightRef = useRef(false);
  const manageModule = searchParams.get("manage");
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [milestoneView, setMilestoneView] = useState<"timeline" | "list">("timeline");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!project || actionInFlightRef.current) return;
    if (!confirm("确定删除此项目？关联事项和日志不会被删除。")) return;

    const button = event.currentTarget;
    actionInFlightRef.current = true;
    button.disabled = true;
    setDeleting(true);
    let shouldRestoreButton = true;

    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        shouldRestoreButton = false;
        window.location.assign("/projects");
        return;
      }
      alert("删除失败，请重试");
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("删除失败，请重试");
    } finally {
      if (shouldRestoreButton) {
        actionInFlightRef.current = false;
        button.disabled = false;
        setDeleting(false);
      }
    }
  };

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
  const actionEntries = items.flatMap((item) => (item.actionItems || []).map((action) => ({ action, item })));
  const openActionEntries = actionEntries.filter(({ action }) => action.status !== "done");
  const overdueActionEntries = openActionEntries.filter(({ action }) => Boolean(action.dueDate && action.dueDate < today));
  const nextDueActionEntry = [...openActionEntries]
    .filter(({ action }) => Boolean(action.dueDate))
    .sort((a, b) => String(a.action.dueDate).localeCompare(String(b.action.dueDate)))[0];
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const cockpitItems = [...items].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.status === "blocked" && b.status !== "blocked") return -1;
    if (a.status !== "blocked" && b.status === "blocked") return 1;
    return toTime(b.updatedAt) - toTime(a.updatedAt);
  }).slice(0, 5);
  const cockpitMilestones = selectCockpitMilestones(milestones, today);
  const { current: currentMilestone, next: nextMilestone } = selectCurrentAndNextMilestones(milestones, today);
  const projectLevelItems = items.filter((item) => !item.milestoneId);
  const milestoneItems = items.filter((item) => Boolean(item.milestoneId));
  const recentProgress = Array.from(new Map([
    ...logs.map((log) => [log.id, { log, itemTitle: log.item?.title || null }] as const),
    ...items.flatMap((item) => (item.logs || []).map((log) => [log.id, { log, itemTitle: item.title }] as const)),
  ]).values()).sort((a, b) => toTime(b.log.createdAt) - toTime(a.log.createdAt)).slice(0, 8);
  const extraMilestones = Math.max(0, milestones.length - cockpitMilestones.length);
  const milestonePhaseCounts = cockpitMilestones.reduce((counts, milestone) => {
    counts[milestonePhase(milestone, today)] += 1;
    return counts;
  }, { past: 0, current: 0, future: 0 });
  const stageLabel = PROJECT_MILESTONE_STAGE_LABELS[project.stage || ""] || PROJECT_STAGE_LABELS[project.stage || ""] || "当前阶段";
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
          <div className="project-cockpit-title-row">
            <h1>{project.name}</h1>
            <Link href={`/projects/${project.id}/edit`} className="project-cockpit-edit-link">
              <Icon name="edit" size={13} /> 编辑项目资料
            </Link>
            <button onClick={handleDelete} className="btn btn-danger item-delete-quiet" disabled={deleting}>
              {deleting ? "删除中..." : (
                <>
                  <Icon name="trash" size={14} /> 删除项目
                </>
              )}
            </button>
          </div>
          <div className="project-cockpit-pills">
            <span className={`project-cockpit-pill is-${project.health}`}>健康 · {HEALTH_LABELS[project.health] || project.health}</span>
            <span className="project-cockpit-pill">{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
            <span className="project-cockpit-pill">{PROJECT_STAGE_LABELS[project.stage || ""] || "阶段待定"}</span>
          </div>
          <p className="project-cockpit-summary">{project.currentSummary || project.description || project.nextAction || "暂未补充项目进展摘要。"}</p>
        </div>
        <div className="project-cockpit-meta" aria-label="项目元信息">
          <div><span>项目经理</span><strong>{project.pm || "—"}</strong></div>
          <div><span>负责人</span><strong>{project.owner || "—"}</strong></div>
          <div><span>开始日期</span><strong>{dateLabel(project.startDate)}</strong></div>
          <div><span>目标日期</span><strong>{dateLabel(project.targetDate)}</strong></div>
          <div><span>项目阶段</span><strong>{PROJECT_STAGE_LABELS[project.stage || ""] || "—"}</strong></div>
          <div><span>发布日期</span><strong>{dateLabel(project.releaseDate)}</strong></div>
          <div><span>开放事项</span><strong>{items.length} 项</strong></div>
          <div><span>核心成员</span><strong>{panelsLoading ? "加载中" : `${coreMembers} 名 · 共 ${members.length} 名`}</strong></div>
        </div>
      </section>

      <section className="project-cockpit-panel project-cockpit-milestones">
        <div className="project-cockpit-panel-head"><div><span>PLANS & NODES · {stageLabel}</span><h2>当前计划与节点</h2></div><div className="project-cockpit-view-switch"><button type="button" className={milestoneView === "timeline" ? "is-active" : ""} onClick={() => setMilestoneView("timeline")}>时间轴</button><button type="button" className={milestoneView === "list" ? "is-active" : ""} onClick={() => setMilestoneView("list")}>列表</button><Link href={`/projects/${project.id}?manage=milestones`} className="project-cockpit-action-link">维护计划</Link></div></div>
        {panelsLoading ? <div className="project-cockpit-panel-loading">正在读取里程碑与计划…</div> : <>
        <div className="project-cockpit-phase-legend"><span className="is-past">已完成 {milestonePhaseCounts.past}</span><span className="is-current">当前推进 {milestonePhaseCounts.current}</span><span className="is-future">后续计划 {milestonePhaseCounts.future}</span></div>
        {milestoneView === "timeline" ? (
          <div className="project-cockpit-axis" aria-label="里程碑时间轴">
            {cockpitMilestones.length === 0 ? <p className="project-cockpit-empty">暂无里程碑</p> : cockpitMilestones.map((milestone) => (
              <div key={milestone.id} className={`project-cockpit-axis-node is-${milestonePhase(milestone, today)}${isRangeMilestone(milestone) ? " is-range" : " is-point"}`}>
                <i /><small>{milestoneScheduleLabel(milestone)}</small><strong>{milestone.title}</strong><em><b>{isRangeMilestone(milestone) ? "周期" : "节点"}</b>{PROJECT_PLAN_TYPE_LABELS[milestone.planType] || PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</em>
              </div>
            ))}
            {extraMilestones > 0 && <Link href={`/projects/${project.id}?manage=milestones`} className="project-cockpit-more">查看其余 {extraMilestones} 项 →</Link>}
          </div>
        ) : <div className="project-cockpit-timeline">
          {cockpitMilestones.length === 0 ? <p className="project-cockpit-empty">暂无里程碑</p> : cockpitMilestones.map((milestone) => (
            <div key={milestone.id} className={`project-cockpit-node is-${milestonePhase(milestone, today)}${isRangeMilestone(milestone) ? " is-range" : " is-point"}`}><i /><div><small><b>{isRangeMilestone(milestone) ? "周期" : "节点"}</b>{milestoneScheduleLabel(milestone)} · {milestonePhase(milestone, today) === "past" ? "已完成" : milestonePhase(milestone, today) === "current" ? "当前推进" : "后续计划"}</small><strong>{milestone.title}</strong><em>{PROJECT_PLAN_TYPE_LABELS[milestone.planType] || PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</em></div></div>
          ))}
          {extraMilestones > 0 && <Link href={`/projects/${project.id}?manage=milestones`} className="project-cockpit-more">查看其余 {extraMilestones} 项 →</Link>}
        </div>}</>}
      </section>

      <section className="project-cockpit-panel project-cockpit-signals">
        <div className="project-cockpit-panel-head"><div><span>SIGNALS</span><h2>当前风险信号</h2></div></div>
        <div className="project-cockpit-signal-list">
          <div><span className="is-critical">P0 / P1</span><strong>{p0Count + p1Count}</strong><small>需优先关注事项</small></div>
          <div><span className="is-critical">阻塞</span><strong>{blockedCount}</strong><small>等待外部条件或决策</small></div>
          <div><span className="is-critical">逾期</span><strong>{overdueCount}</strong><small>超过截止日期的开放事项</small></div>
          <div><span className="is-warning">红黄风险</span><strong>{riskCount}</strong><small>健康度需跟踪</small></div>
        </div>
      </section>

      <section className="project-cockpit-panel project-cockpit-str-context">
        <div className="project-cockpit-panel-head"><div><span>STR CONTEXT</span><h2>当前 / 下一 STR</h2></div></div>
        <div className="project-cockpit-signal-list">
          <div><span>当前 STR</span><strong>{currentMilestone?.title || "暂无明确当前 STR"}</strong><small>{currentMilestone ? `状态：${PROJECT_MILESTONE_STATUS_LABELS[currentMilestone.status] || currentMilestone.status}` : "按真实状态、日期和排序计算"}</small></div>
          <div><span>下一 STR</span><strong>{nextMilestone?.title || "暂无下一 STR"}</strong><small>{nextMilestone ? milestoneScheduleLabel(nextMilestone) : "暂无未来计划"}</small></div>
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
        <div className="project-cockpit-panel-head"><div><span>ITEMS · STR</span><h2>开放事项 · {items.length} 项</h2></div><Link href={`/items?projectId=${project.id}`} className="project-cockpit-action-link">查看所有事项</Link></div>
        <div className="project-cockpit-action-summary" aria-label="行动执行信号">
          <div><span>未完成行动项</span><strong>{openActionEntries.length}</strong><small>仍需推动</small></div>
          <div><span>逾期行动项</span><strong>{overdueActionEntries.length}</strong><small>截止日期早于今天</small></div>
          <div><span>最近到期</span><strong>{nextDueActionEntry ? dateLabel(nextDueActionEntry.action.dueDate) : "暂无"}</strong><small>{nextDueActionEntry?.item.title || "没有设置截止日期的开放行动"}</small></div>
        </div>
        <div className="project-cockpit-item-list">
          {cockpitItems.length === 0 ? <p className="project-cockpit-empty">暂无开放事项</p> : cockpitItems.map((item: WorkItem) => { const openActions = (item.actionItems || []).filter((action) => action.status !== "done"); const overdueActions = openActions.filter((action) => Boolean(action.dueDate && action.dueDate < today)); const latestLog = (item.logs || [])[0]; return <Link key={item.id} href={`/items/${item.id}`}><span className={`badge badge-${item.priority.toLowerCase()}`}>{PRIORITY_LABELS[item.priority]}</span><small className="mono">{item.sourceId || item.id.slice(-6)}</small><div><strong>{item.title}</strong><em>{item.milestone?.title || "项目级事项"} · {item.owner || "未分配"} · {item.status === "blocked" ? "阻塞" : "跟进中"}</em><small>{openActions.length} 个开放行动项{overdueActions.length ? ` · ${overdueActions.length} 个逾期` : ""}{latestLog ? ` · 最近进展：${latestLog.note || latestLog.content || latestLog.title}` : ""}</small></div><time className={item.dueDate && item.dueDate < today ? "is-overdue" : ""}>{dateLabel(item.dueDate)}</time></Link>; })}
        </div>
        <div className="project-cockpit-module-summary"><strong>STR 事项 {milestoneItems.length} · 项目级事项 {projectLevelItems.length}</strong><span>事项的 STR 归属只来自 milestoneId；未归属事项保持项目级。</span></div>
        {projectLevelItems.length > 0 && <div className="project-cockpit-sublist"><strong>项目级事项 / 未归属 STR</strong>{projectLevelItems.slice(0, 4).map((item) => <Link key={item.id} href={`/items/${item.id}`}><span>{item.title}</span><small>{item.owner || "未分配"} · {dateLabel(item.dueDate)}</small></Link>)}</div>}
      </section>

      <section className="project-cockpit-panel project-cockpit-items project-cockpit-wbs">
        <div className="project-cockpit-panel-head"><div><span>WBS READINESS</span><h2>{currentMilestone ? `${currentMilestone.title} · WBS readiness` : "当前 STR · WBS readiness"}</h2></div></div>
        <ProjectWbsSummarySection projectId={project.id} />
      </section>

      <section className="project-cockpit-panel project-cockpit-facts">
        <div className="project-cockpit-panel-head"><div><span>FACTS</span><h2>最近事实（本项目）</h2></div><small>今日 {todayLogCount} · 昨日 {yesterdayLogCount}</small></div>
        <div className="project-cockpit-fact-list">
          {recentProgress.map(({ log, itemTitle }) => <Link key={log.id} href={`/logs/${log.id}`}><time className="mono">{logTime(log, today)}</time><span className={`project-cockpit-kind is-${log.type}`}>{itemTitle ? "事项进展" : factKind(log)}</span><div><strong>{log.note || log.content || log.title}</strong><em>{itemTitle || log.item?.title || log.module || "项目记录"}</em></div></Link>)}
          {recentProgress.length === 0 && <p className="project-cockpit-empty">暂无项目进展记录</p>}
        </div>
      </section>
    </main>
  );
}
