import Link from "next/link";
import { prisma } from "@/lib/prisma";

function dateKey(value: Date | null) { return value ? value.toISOString().slice(0, 10) : null; }

export default async function TodayWbsQueue({ today }: { today: string }) {
  const horizon = new Date(`${today}T00:00:00`);
  horizon.setDate(horizon.getDate() + 14);
  const nodes = await prisma.projectWbsNode.findMany({
    where: { plan: { status: "active" }, status: { notIn: ["done", "waived"] } },
    include: { project: { select: { id: true, name: true } }, milestone: { select: { targetDate: true } } },
    orderBy: [{ internalCheckDate: "asc" }, { sortOrder: "asc" }],
    take: 200,
  });
  const dueNodes = nodes.filter((node) => {
    const internalDue = Boolean(node.internalCheckDate && node.internalCheckDate <= today);
    const milestoneNear = Boolean(node.milestone.targetDate && node.milestone.targetDate <= horizon);
    return node.status === "blocked" || internalDue || milestoneNear;
  }).slice(0, 12);
  if (nodes.length === 0) return null;

  return <section className="wbs-today-queue"><div className="wbs-today-queue-head"><div><span className="wbs-eyebrow">WBS QUEUE</span><h2>WBS 待处理</h2></div><span>按内部检查日期、STR目标日期或阻塞状态呈现</span></div>{dueNodes.length === 0 ? <p className="wbs-empty">当前没有需要处理的 WBS 节点。</p> : <div className="wbs-today-list">{dueNodes.map((node) => <Link key={node.id} href={`/projects/${node.project.id}/wbs/${node.gateKey}`}><span>{node.gateKey}</span><strong>{node.code} · {node.title}</strong><small>{node.project.name} · 角色 {node.role || "未设置"} · {node.status === "blocked" ? "阻塞" : `目标 ${dateKey(node.milestone.targetDate) || "未设置"}`}</small></Link>)}</div>}</section>;
}
