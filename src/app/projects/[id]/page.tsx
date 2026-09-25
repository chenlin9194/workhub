"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import PageLoadingState from "@/components/PageLoadingState";
import ProjectLinkSection from "@/components/ProjectLinkSection";
import ProjectMemberSection from "@/components/ProjectMemberSection";
import ProjectMilestoneSection from "@/components/ProjectMilestoneSection";
import ProjectWbsSummarySection from "@/components/ProjectWbsSummarySection";
import {
  HEALTH_LABELS,
  ACTION_ITEM_STATUS_LABELS,
  PRIORITY_LABELS,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_MILESTONE_STAGE_LABELS,
  PROJECT_PLAN_TYPE_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  STATUS_LABELS,
  WORK_LOG_TYPE_LABELS,
} from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import type { ActionItem, Project, ProjectLink, ProjectMember, ProjectMilestone, WorkLog } from "@/lib/types";
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

function actionRank(action: ActionItem, today: string) {
  if (action.dueDate && action.dueDate < today) return 0;
  if (action.status === "pending") return 1;
  return 2;
}

function compareActions(a: ActionItem, b: ActionItem, today: string) {
  return actionRank(a, today) - actionRank(b, today) ||
    Number(Boolean(b.dueDate)) - Number(Boolean(a.dueDate)) ||
    (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
    a.sortOrder - b.sortOrder ||
    toTime(a.createdAt) - toTime(b.createdAt) ||
    a.id.localeCompare(b.id);
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
  const [milestoneView, setMilestoneView] = useState<"timeline" | "list">("list");
  const [deleting, setDeleting] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionReadState, setActionReadState] = useState<"loading" | "ready" | "error">("loading");
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [factsExpanded, setFactsExpanded] = useState(false);

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

  const projectId = project?.id;
  useEffect(() => {
    if (!projectId || manageModule) return;
    const controller = new AbortController();
    setActionReadState("loading");
    setActionItems([]);
    fetch(`/api/action-items?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("读取行动项失败");
        const payload: { actionItems?: ActionItem[] } = await response.json();
        if (!Array.isArray(payload.actionItems)) throw new Error("行动项数据无效");
        setActionItems(payload.actionItems);
        setActionReadState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Error fetching project action summary:", error);
        setActionReadState("error");
      });
    return () => controller.abort();
  }, [projectId, manageModule]);

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
  });
  const cockpitMilestones = selectCockpitMilestones(milestones, today);
  const { current: currentMilestone, next: nextMilestone } = selectCurrentAndNextMilestones(milestones, today);
  const projectLevelItems = items.filter((item) => !item.milestoneId);
  const milestoneItems = items.filter((item) => Boolean(item.milestoneId));
  const recentProgress = Array.from(new Map([
    ...logs.map((log) => [log.id, { log, itemTitle: log.item?.title || null }] as const),
    ...items.flatMap((item) => (item.logs || []).map((log) => [log.id, { log, itemTitle: item.title }] as const)),
  ]).values()).sort((a, b) => toTime(b.log.createdAt) - toTime(a.log.createdAt));
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
  const openItemIds = new Set(items.map((item) => item.id));
  const openReadActions = actionReadState === "ready"
    ? actionItems.filter((action) => action.projectId === project.id && action.workItemId && openItemIds.has(action.workItemId) && action.status !== "done")
    : [];
  const completedReadActionCount = actionReadState === "ready"
    ? actionItems.filter((action) => action.projectId === project.id && action.workItemId && openItemIds.has(action.workItemId) && action.status === "done").length
    : 0;
  const actionsByItem = new Map<string, ActionItem[]>();
  for (const action of openReadActions) {
    const itemActions = actionsByItem.get(action.workItemId!) || [];
    itemActions.push(action);
    actionsByItem.set(action.workItemId!, itemActions);
  }
  for (const itemActions of actionsByItem.values()) itemActions.sort((a, b) => compareActions(a, b, today));
  const executionItems = [...cockpitItems].sort((a, b) => {
    if (actionReadState !== "ready") return 0;
    const aAction = actionsByItem.get(a.id)?.[0];
    const bAction = actionsByItem.get(b.id)?.[0];
    if (aAction && bAction) return compareActions(aAction, bAction, today);
    return Number(Boolean(bAction)) - Number(Boolean(aAction));
  });
  const visibleItems = itemsExpanded ? executionItems : executionItems.slice(0, 5);
  const leadActionId = [...openReadActions].sort((a, b) => compareActions(a, b, today))[0]?.id;
  const visibleFacts = factsExpanded ? recentProgress : recentProgress.slice(0, 3);

  return (
    <div className="project-quiet">
      <header className="project-quiet-header">
        <div className="project-quiet-header-main">
          <Link href="/projects" className="project-quiet-back">← 项目列表</Link>
          <div className="project-quiet-title-line">
            <h1>{project.name}</h1>
            {project.code && <span className="project-quiet-code">{project.code}</span>}
          </div>
          <div className="project-quiet-status">
            <span>{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
            <span className={"is-" + project.health}>健康 · {HEALTH_LABELS[project.health] || project.health}</span>
            <span className="is-stage">阶段 · {PROJECT_STAGE_LABELS[project.stage || ""] || "待定"}</span>
          </div>
          <p className="project-quiet-summary">{project.currentSummary || project.description || project.nextAction || "暂未补充项目进展摘要。"}</p>
        </div>
        <div className="project-quiet-header-side">
          <dl className="project-quiet-head-facts">
            <div><dt>PM / 负责人</dt><dd>{project.pm && project.owner && project.pm !== project.owner ? project.pm + " / " + project.owner : project.pm || project.owner || "—"}</dd></div>
            <div><dt>目标日期</dt><dd>{dateLabel(project.targetDate)}</dd></div>
            <div><dt>开始日期</dt><dd>{dateLabel(project.startDate)}</dd></div>
          </dl>
          <div className="project-quiet-head-actions">
            <Link href={"/projects/" + project.id + "/edit"} className="project-quiet-text-action">编辑项目资料</Link>
            <button type="button" onClick={handleDelete} className="project-quiet-danger-action" disabled={deleting}>{deleting ? "删除中..." : "删除项目"}</button>
          </div>
        </div>
      </header>

      <section className="project-quiet-risk" aria-label="当前风险信号">
        <h2>风险信号</h2>
        <div className={p0Count + p1Count ? undefined : "is-zero"}><span>P0 / P1</span><strong className={p0Count + p1Count ? "is-risk" : ""}>{p0Count + p1Count}</strong></div>
        <div className={overdueCount ? undefined : "is-zero"}><span>逾期事项</span><strong className={overdueCount ? "is-risk" : ""}>{overdueCount}</strong></div>
        <div className={blockedCount ? undefined : "is-zero"}><span>阻塞</span><strong className={blockedCount ? "is-risk" : ""}>{blockedCount}</strong></div>
        <div className={riskCount ? undefined : "is-zero"}><span>红黄风险</span><strong className={riskCount ? "is-warning" : ""}>{riskCount}</strong></div>
      </section>

      <div className="project-quiet-body">
        <section className="project-quiet-execution" id="project-execution">
          <div className="project-quiet-section-head">
            <div><h2>开放事项</h2><span>{items.length} 项 · 当前已加载事项</span></div>
            <Link href={"/items?projectId=" + project.id}>查看所有事项 ↗</Link>
          </div>
          <p className="project-quiet-execution-note">
            {actionReadState === "ready" ? "待推行动 " + openReadActions.length + " 项" : actionReadState === "loading" ? "正在读取待推行动…" : "行动详情暂不可用"}
            {actionReadState === "ready" && openReadActions.length > 0 && <span> · 逾期 {openReadActions.filter((action) => Boolean(action.dueDate && action.dueDate < today)).length} 项</span>}
            {completedReadActionCount > 0 && <span> · 已完成 {completedReadActionCount} 项</span>}
            <span> · 完整行动处理请进入事项详情</span>
          </p>
          {actionReadState === "error" && <div className="project-quiet-action-fallback" role="status">
            <strong>行动详情读取失败</strong>
            <span>当前已加载事项中，未完成 {openActionEntries.length} 项 · 逾期 {overdueActionEntries.length} 项 · 最近到期 {nextDueActionEntry ? dateLabel(nextDueActionEntry.action.dueDate) : "暂无"}</span>
            <span>可从下方事项进入完整行动记录。</span>
          </div>}
          {visibleItems.length === 0 && <p className="project-quiet-empty">暂无开放事项；可从全部事项查看历史记录。</p>}
          <div className="project-quiet-item-list">
            {visibleItems.map((item) => {
              const itemActions = actionsByItem.get(item.id) || [];
              const embeddedOpenActions = (item.actionItems || []).filter((action) => action.status !== "done");
              const latestLog = (item.logs || [])[0];
              return <article key={item.id} className="project-quiet-item">
                <div className="project-quiet-item-heading">
                  <span className={"project-quiet-priority is-" + item.priority.toLowerCase()}>{PRIORITY_LABELS[item.priority]}</span>
                  <h3><Link href={"/items/" + item.id}>{item.title}</Link></h3>
                  <span className="project-quiet-item-state">{STATUS_LABELS[item.status] || item.status}</span>
                </div>
                {(item.currentSummary || item.description || item.nextAction) && <p className="project-quiet-item-summary">{item.currentSummary || item.description || item.nextAction}</p>}
                <div className="project-quiet-item-meta">
                  <span>{item.owner || "未分配负责人"}</span>
                  <span className={item.dueDate && item.dueDate < today ? "is-overdue" : ""}>截止 {dateLabel(item.dueDate)}{item.dueDate && item.dueDate < today ? " · 已逾期" : ""}</span>
                  <span>{item.milestone?.title || "项目级 · 未归属 STR"}</span>
                </div>
                {actionReadState === "ready" && itemActions.length > 0 && <div className="project-quiet-actions">
                  <div className="project-quiet-actions-label">待推行动 {itemActions.length} 项</div>
                  {itemActions.map((action) => {
                    const progress = action.progressLogs?.[0];
                    const overdue = Boolean(action.dueDate && action.dueDate < today);
                    return <div key={action.id} className={"project-quiet-action" + (action.id === leadActionId ? " is-lead" : "")}>
                      <div className="project-quiet-action-top">
                        <span>待推进行动{overdue ? " · 已逾期" : ""}</span>
                        <span>{ACTION_ITEM_STATUS_LABELS[action.status] || action.status}</span>
                      </div>
                      <h4>{action.title}</h4>
                      <div className="project-quiet-action-meta">
                        <span>负责人 {action.owner || "未分配"}</span>
                        <span className={overdue ? "is-overdue" : ""}>截止 {dateLabel(action.dueDate)}</span>
                      </div>
                      <div className="project-quiet-action-bottom">
                        <span>最近进展 {progress ? progress.note || progress.content || progress.title : "暂无进展记录"}</span>
                        <Link href={"/items/" + item.id}>查看行动 →</Link>
                      </div>
                    </div>;
                  })}
                </div>}
                {actionReadState === "ready" && itemActions.length === 0 && <p className="project-quiet-no-action">暂无待推行动{embeddedOpenActions.length ? "；请在事项详情核对行动记录" : ""}</p>}
                {actionReadState === "loading" && <p className="project-quiet-no-action" role="status">正在读取此事项的行动…</p>}
                {latestLog && <p className="project-quiet-latest"><span>最近进展</span>{latestLog.note || latestLog.content || latestLog.title}</p>}
              </article>;
            })}
          </div>
          {executionItems.length > 5 && <button type="button" className="project-quiet-expand" onClick={() => setItemsExpanded(!itemsExpanded)} aria-expanded={itemsExpanded}>{itemsExpanded ? "收起事项" : "查看其余 " + (executionItems.length - 5) + " 项已加载事项"}</button>}
          {project.nextAction && project.nextAction !== project.currentSummary && <p className="project-quiet-next"><strong>项目下一步</strong>{project.nextAction}</p>}
        </section>

        <aside className="project-quiet-context" aria-label="阶段与 WBS 上下文">
          <section className="project-quiet-plan" id="project-plan">
            <div className="project-quiet-section-head"><h2>STR / 阶段计划</h2><Link href={"/projects/" + project.id + "?manage=milestones"}>维护计划 ↗</Link></div>
            <div className="project-quiet-current-str"><span>当前 STR</span><strong>{currentMilestone?.title || "暂无明确当前 STR"}</strong><small>{currentMilestone ? "状态：" + (PROJECT_MILESTONE_STATUS_LABELS[currentMilestone.status] || currentMilestone.status) : "按真实状态、日期和排序计算"}</small></div>
            {nextMilestone && <p className="project-quiet-next-str">下一 STR <strong>{nextMilestone.title}</strong><time>{milestoneScheduleLabel(nextMilestone)}</time></p>}
            <div className="project-quiet-plan-toolbar">
              <span>{stageLabel} · 已完成 {milestonePhaseCounts.past} / 当前 {milestonePhaseCounts.current} / 后续 {milestonePhaseCounts.future}</span>
              <div><button type="button" className={milestoneView === "timeline" ? "is-active" : ""} onClick={() => setMilestoneView("timeline")}>时间轴</button><button type="button" className={milestoneView === "list" ? "is-active" : ""} onClick={() => setMilestoneView("list")}>列表</button></div>
            </div>
            {panelsLoading ? <p className="project-quiet-empty">正在读取里程碑与计划…</p> : <div className={"project-quiet-plan-list is-" + milestoneView}>
              {cockpitMilestones.length === 0 ? <p className="project-quiet-empty">暂无里程碑</p> : cockpitMilestones.map((milestone) => <div key={milestone.id} className={"project-quiet-plan-row is-" + milestonePhase(milestone, today)}>
                <div><strong>{milestone.title}</strong>{(isRangeMilestone(milestone) || milestone.planType !== "milestone" || milestonePhase(milestone, today) !== "future") && <small>{isRangeMilestone(milestone) ? "周期" : "节点"} · {PROJECT_PLAN_TYPE_LABELS[milestone.planType] || PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</small>}</div>
                <time>{milestoneScheduleLabel(milestone)}</time>
              </div>)}
            </div>}
            {extraMilestones > 0 && <Link className="project-quiet-more" href={"/projects/" + project.id + "?manage=milestones"}>查看其余 {extraMilestones} 项计划节点 ↗</Link>}
          </section>
          <ProjectWbsSummarySection projectId={project.id} compact />
        </aside>
      </div>

      <section className="project-quiet-facts" id="project-facts">
        <div className="project-quiet-section-head"><div><h2>最近事实</h2><span>{recentProgress.length} 条 · 今日 {todayLogCount} / 昨日 {yesterdayLogCount}</span></div></div>
        <div className="project-quiet-fact-list">
          {visibleFacts.map(({ log, itemTitle }) => <Link key={log.id} href={"/logs/" + log.id} className="project-quiet-fact">
            <time>{dateLabel(log.workDate)}</time><span>{itemTitle ? "事项进展" : factKind(log)}</span><strong>{log.note || log.content || log.title}</strong><em>{itemTitle || log.item?.title || log.module || "项目记录"} ↗</em>
          </Link>)}
          {recentProgress.length === 0 && <p className="project-quiet-empty">暂无项目进展记录</p>}
        </div>
        {recentProgress.length > 3 && <button type="button" className="project-quiet-expand" onClick={() => setFactsExpanded(!factsExpanded)} aria-expanded={factsExpanded}>{factsExpanded ? "收起事实" : "查看全部 " + recentProgress.length + " 条事实"}</button>}
      </section>

      <section className="project-quiet-resources">
        <div className="project-quiet-section-head"><h2>项目资料</h2><Link href={"/projects/" + project.id + "/edit"}>编辑资料 ↗</Link></div>
        {project.description && project.description !== project.currentSummary && <p className="project-quiet-description">{project.description}</p>}
        <div className="project-quiet-resource-facts"><span>开始 {dateLabel(project.startDate)}</span><span>发布 {dateLabel(project.releaseDate)}</span><span>STR 事项 {milestoneItems.length} · 项目级事项 {projectLevelItems.length}</span></div>
        <div className="project-quiet-resource-links">
          <Link href={"/projects/" + project.id + "?manage=members"}>项目成员 <strong>{panelsLoading ? "加载中" : coreMembers + " 核心 · 共 " + members.length + " 名"}</strong> ↗</Link>
          <Link href={"/projects/" + project.id + "?manage=links"}>关键链接 <strong>{panelsLoading ? "加载中" : (links.length || (project.sourceUrl ? 1 : 0)) + " 个已收录"}</strong> ↗</Link>
          <Link href={"/projects/" + project.id + "?manage=milestones"}>完整阶段计划 <strong>{panelsLoading ? "加载中" : milestones.length + " 个节点"}</strong> ↗</Link>
        </div>
        <p className="project-quiet-footnote">事项的 STR 归属仅来自已有里程碑关系；WBS 当前门禁独立表示执行准备度。</p>
      </section>
    </div>
  );
}
