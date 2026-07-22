import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deriveStrReadiness } from "@/lib/wbs/readiness";

export default async function WbsReportFacts() {
  const plans = await prisma.projectWbsPlan.findMany({
    where: { status: "active" },
    include: { project: { select: { id: true, name: true } }, nodes: { include: { deliverables: true } } },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
  if (plans.length === 0) return null;

  const facts = plans.map((plan) => {
    const execution = plan.nodes.filter((node) => node.kind === "task" || node.kind === "gate");
    const roles = new Set(execution.map((node) => node.role?.trim()).filter(Boolean));
    const roleTaskCount = execution.filter((node) => node.role?.trim()).length;
    const pending = execution.reduce((count, node) => count + node.deliverables.filter((deliverable) => deliverable.required && deliverable.status !== "delivered").length, 0);
    const blocked = execution.filter((node) => node.status === "blocked").length;
    const waived = execution.filter((node) => node.status === "waived").length;
    const waivedEntries = execution.filter((node) => node.status === "waived").map((node) => ({ gateKey: node.gateKey, code: node.code, title: node.title, reason: node.waiverReason || "未记录原因" }));
    const currentGate = ["STR1", "STR2", "STR3", "STR4", "STR4A", "STR5"].map((gateKey) => {
      const nodes = execution.filter((node) => node.gateKey === gateKey);
      return { gateKey, readiness: deriveStrReadiness(gateKey as "STR1" | "STR2" | "STR3" | "STR4" | "STR4A" | "STR5", nodes.map((node) => ({ kind: node.kind as "task" | "gate", status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null, requiredDeliverables: node.deliverables.map((deliverable) => ({ required: deliverable.required, status: deliverable.status as "pending" | "delivered" })) })))};
    }).find((entry) => entry.readiness.status !== "closed");
    return { plan, currentGate: currentGate?.gateKey || "STR5", roleCount: roles.size, roleTaskCount, pending, blocked, waived, waivedEntries };
  });

  return <section className="card wbs-report-facts"><div className="dashboard-section-title"><div><span className="wbs-eyebrow">WBS FACTS</span><h2>WBS 执行事实</h2></div><span className="section-count">独立事实区块</span></div><div className="wbs-report-fact-grid">{facts.map((fact) => <Link key={fact.plan.id} href={`/projects/${fact.plan.project.id}/wbs`}><strong>{fact.plan.project.name}</strong><span>当前 STR {fact.currentGate}</span><small>WBS 角色 {fact.roleCount} 个 · 角色任务 {fact.roleTaskCount} 个 · 未闭环 {fact.plan.nodes.filter((node) => node.kind !== "package" && node.status !== "done" && node.status !== "waived").length}</small><small>阻塞 {fact.blocked} · 待交付 {fact.pending} · 豁免 {fact.waived}</small>{fact.waivedEntries.length > 0 && <em>豁免原因：{fact.waivedEntries.slice(0, 2).map((entry) => `${entry.code} ${entry.reason}`).join("；")}</em>}</Link>)}</div></section>;
}
