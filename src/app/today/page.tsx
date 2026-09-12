import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Icon from "@/components/Icon";
import TodayActionQueue from "@/components/TodayActionQueue";
import { getLocalDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = getLocalDateString();
  const actions = await prisma.actionItem.findMany({
    where: { status: { not: "done" } },
    include: {
      workItem: { select: { id: true, title: true, milestone: { select: { title: true, gateKey: true } } } },
      workLog: { select: { id: true, title: true } },
      project: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ dueDate: "asc" }, { status: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="page-shell auxiliary-page today-page">
      <header className="command-page-header">
        <div><span className="section-eyebrow">ACTION QUEUE</span><h1>今日</h1><p>逾期、今日到期和即将处理的 ActionItem 队列 · {today}</p></div>
        <div className="page-header-actions"><Link href="/items" className="btn btn-secondary"><Icon name="list" size={14} />查看事项</Link><Link href="/reports" className="btn btn-primary">进入汇报</Link></div>
      </header>
      <TodayActionQueue initialItems={actions} today={today} />
      <section className="card cockpit-card"><div className="cockpit-card-head"><div><span className="section-eyebrow">COMPLETED</span><h2>已完成行动项</h2></div><span className="section-count">完成记录在事项时间线中查看</span></div><p className="today-compact-empty"><span />今日页聚焦待处理队列；已完成行动项请进入对应事项查看统一时间线。</p></section>
    </div>
  );
}
