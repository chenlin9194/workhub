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
        <div><h1>行动队列</h1><p>集中处理逾期、今日到期和即将处理的行动项 · {today}</p></div>
        <div className="page-header-actions"><Link href="/items" className="btn btn-secondary"><Icon name="list" size={14} />查看事项</Link><Link href="/reports" className="btn btn-primary">进入汇报</Link></div>
      </header>
      <TodayActionQueue initialItems={actions} today={today} />
      <p className="today-completed-note">已完成行动的处理结论保存在对应事项时间线中。</p>
    </div>
  );
}
