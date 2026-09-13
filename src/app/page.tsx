import Link from "next/link";
import Icon from "@/components/Icon";
import HomeTopbarActions from "@/components/HomeTopbarActions";
import SidebarNavigation from "@/components/SidebarNavigation";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/utils";
import { selectCurrentAndNextMilestones } from "@/lib/projectMilestoneView";
import { ACTION_ITEM_STATUS_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function displayDate(value?: string | null) {
  return value || "未设置截止日期";
}

function displayProgressTime(value: Date | string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function WorkbenchPage() {
  const today = getLocalDateString();
  const dueSoon = new Date(`${today}T00:00:00`);
  dueSoon.setDate(dueSoon.getDate() + 7);
  const dueSoonKey = dueSoon.toISOString().slice(0, 10);

  const [actions, projects, recentLogs] = await Promise.all([
    prisma.actionItem.findMany({
      where: { status: { not: "done" }, OR: [{ dueDate: { lt: today } }, { dueDate: today }, { dueDate: { lte: dueSoonKey } }] },
      include: { workItem: { select: { id: true, title: true, projectId: true, projectRef: { select: { name: true } }, milestone: { select: { title: true, gateKey: true } } } }, project: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 20,
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        milestones: { orderBy: [{ sortOrder: "asc" }, { targetDate: "asc" }] },
        items: { where: { status: { not: "closed" } }, select: { id: true, milestoneId: true, actionItems: { select: { status: true, dueDate: true } } } },
      },
    }),
    prisma.workLog.findMany({
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: {
        item: { select: { id: true, title: true, projectId: true, projectRef: { select: { name: true } }, milestone: { select: { title: true, gateKey: true } } } },
        actionItem: { select: { id: true, title: true, workItem: { select: { id: true, title: true } } } },
      },
    }),
  ]);

  return (
    <div className="dashboard-shell redesign-dashboard-shell">
      <SidebarNavigation />
      <div className="cockpit-content redesign-cockpit-content">
        <header className="cockpit-topbar redesign-topbar">
          <div><span className="cockpit-path">WORK / WORKBENCH</span><strong>{today}</strong></div>
          <form action="/items" className="cockpit-search"><Icon name="search" size={14} /><input type="hidden" name="visibility" value="open" /><input name="keyword" placeholder="搜索未关闭事项" /></form>
          <div className="redesign-topbar-actions"><Link href="/items/new" className="btn btn-primary btn-sm">＋ 新建事项</Link><HomeTopbarActions /></div>
        </header>

        <main className="redesign-dashboard">
          <header className="redesign-page-header"><div><span>WORKHUB V3 WORKBENCH</span><h1>工作台</h1><p>先处理行动项，再查看项目和最近发生的进展。</p></div><Link href="/reports" className="btn btn-secondary btn-sm">进入汇报</Link></header>

          <section className="card cockpit-card">
            <div className="cockpit-card-head"><div><span className="section-eyebrow">TODAY ACTIONS</span><h2>今日行动</h2></div><Link href="/today" className="section-link">查看完整队列 <Icon name="chevron-right" size={14} /></Link></div>
            {actions.length === 0 ? <div className="redesign-empty">当前没有需要处理的行动项。</div> : (
              <div className="today-action-item-list">
                {actions.slice(0, 8).map((action) => {
                  const overdue = Boolean(action.dueDate && action.dueDate < today);
                  return (
                    <Link key={action.id} href={action.workItemId ? `/items/${action.workItemId}` : "/today"} className={`today-action-item${overdue ? " today-action-item--overdue" : ""}`}>
                      <div className="today-action-item-main">
                        <div className="today-action-item-title">{action.title}</div>
                        <div className="today-action-item-meta">
                          <span>{overdue ? "已逾期" : action.dueDate === today ? "今日截止" : "即将到期"}</span>
                          <span>{ACTION_ITEM_STATUS_LABELS[action.status] || action.status}</span>
                          {action.owner && <span>负责人：{action.owner}</span>}
                          <span>{displayDate(action.dueDate)}</span>
                          {action.workItem && <span>事项：{action.workItem.title}</span>}
                          {action.workItem?.milestone && <span>STR：{action.workItem.milestone.gateKey ? `${action.workItem.milestone.gateKey} · ` : ""}{action.workItem.milestone.title}</span>}
                        </div>
                      </div>
                      <Icon name="chevron-right" size={15} />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card cockpit-card">
            <div className="cockpit-card-head"><div><span className="section-eyebrow">PROJECTS</span><h2>项目</h2></div><Link href="/projects" className="section-link">查看全部 <Icon name="chevron-right" size={14} /></Link></div>
            <div className="content-card-grid">{projects.map((project) => { const { current, next } = selectCurrentAndNextMilestones(project.milestones, today); const openActions = project.items.flatMap((item) => item.actionItems).filter((item) => item.status !== "done"); const overdueActions = openActions.filter((item) => Boolean(item.dueDate && item.dueDate < today)); const projectLevel = project.items.filter((item) => !item.milestoneId).length; return <Link key={project.id} href={`/projects/${project.id}`} className="card card-hover" style={{ padding: 16, textDecoration: "none" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{project.name}</strong><span className="entity-pill entity-pill--muted">{PROJECT_STATUS_LABELS[project.status] || project.status}</span></div><div className="detail-side-entry"><span>当前 STR</span><strong>{current?.title || "暂无明确当前 STR"}</strong></div><div className="today-action-item-meta"><span>下一 STR：{next?.title || "暂无"}</span><span>{project.items.length} 个开放事项</span><span>{openActions.length} 个开放行动项</span>{overdueActions.length > 0 && <span>逾期行动项 {overdueActions.length}</span>}<span>项目级事项 {projectLevel}</span></div></Link>})}</div>
          </section>

          <section className="card cockpit-card">
            <div className="cockpit-card-head"><div><span className="section-eyebrow">RECENT PROGRESS</span><h2>最近进展</h2></div><Link href="/logs" className="section-link">打开记录库 <Icon name="chevron-right" size={14} /></Link></div>
            {recentLogs.length === 0 ? <div className="redesign-empty">暂无最近进展。</div> : <div className="project-cockpit-fact-list">{recentLogs.map((log) => { const itemTitle = log.actionItem?.workItem?.title || log.item?.title; const actionTitle = log.actionItem?.title; return <Link key={log.id} href={`/logs/${log.id}`}><time className="mono">{displayProgressTime(log.createdAt)}</time><span className="project-cockpit-kind">{actionTitle ? `行动项 · ${actionTitle}` : itemTitle ? "事项记录" : "项目记录"}</span><div><strong>{log.note || log.content || log.title}</strong><em>{itemTitle || "未关联事项"}{log.item?.milestone ? ` · ${log.item.milestone.title}` : ""}</em></div></Link>; })}</div>}
          </section>
        </main>
      </div>
    </div>
  );
}
