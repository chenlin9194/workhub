"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deriveStrReadiness } from "@/lib/wbs/readiness";

type WbsNode = { gateKey: string; kind: string; status: string | null; deliverables: Array<{ required: boolean; status: string }>; milestone: { title: string; targetDate: string | null } };
type Summary = { plan: { profile: string; template: { version: string }; nodes: WbsNode[] } | null };

export default function ProjectWbsSummarySection({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/wbs`);
    if (response.ok) setSummary(await response.json());
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  if (!summary?.plan) return null;

  const gates = ["STR1", "STR2", "STR3", "STR4", "STR4A", "STR5"].map((gateKey) => {
    const nodes = summary.plan?.nodes.filter((node) => node.gateKey === gateKey) ?? [];
    return { gateKey, readiness: deriveStrReadiness(gateKey as "STR1" | "STR2" | "STR3" | "STR4" | "STR4A" | "STR5", nodes.map((node) => ({ kind: node.kind as "package" | "task" | "gate", status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null, requiredDeliverables: node.deliverables.map((deliverable) => ({ required: deliverable.required, status: deliverable.status as "pending" | "delivered" })) }))), milestone: nodes[0]?.milestone };
  });
  const currentGate = gates.find((gate) => gate.readiness.status !== "closed")?.gateKey ?? null;

  return <section className="project-cockpit-panel wbs-project-summary"><div className="project-cockpit-panel-head"><div><span className="wbs-eyebrow">WBS ADD-ON</span><h2>WBS 执行摘要</h2></div><Link href={`/projects/${projectId}/wbs`} className="project-cockpit-action-link">打开 WBS 总览</Link></div><div className="wbs-project-summary-meta"><span>模板 {summary.plan.template.version}</span><span>项目类型 {summary.plan.profile}</span><span>WBS 独立维护，不替换现有里程碑</span></div><div className="wbs-project-summary-grid">{gates.map((gate) => { const isCurrent = gate.gateKey === currentGate; return <Link key={gate.gateKey} href={`/projects/${projectId}/wbs/${gate.gateKey}`} aria-current={isCurrent ? "step" : undefined} className={`wbs-project-summary-card is-${gate.readiness.status}${isCurrent ? " is-current" : ""}`}><div className="wbs-project-summary-card-head"><strong>{gate.gateKey}</strong>{isCurrent && <span>当前推进</span>}</div><span>{gate.readiness.completedExecutionNodes}/{gate.readiness.totalExecutionNodes} 完成</span><small>待交付 {gate.readiness.pendingRequiredDeliverables} · {gate.readiness.nextAction || "继续推进"}</small></Link>; })}</div></section>;
}
