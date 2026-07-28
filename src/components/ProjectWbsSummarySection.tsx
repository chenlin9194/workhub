"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deriveStrReadiness } from "@/lib/wbs/readiness";

type WbsNode = {
  gateKey: string;
  kind: string;
  status: string | null;
  deliverables: Array<{ required: boolean; status: string }>;
  milestone: { title: string; targetDate: string | null };
};

type Summary = {
  template: { version: string; sourceFileName: string; nodeCount: number } | null;
  plan: {
    template: { version: string };
    nodes: WbsNode[];
  } | null;
};

const GATE_KEYS = ["STR1", "STR2", "STR3", "STR4", "STR4A", "STR5"] as const;

export default function ProjectWbsSummarySection({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/wbs`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取 WBS 状态失败");
      setSummary(data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "读取 WBS 状态失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <section className="project-cockpit-panel wbs-project-summary"><div className="project-cockpit-panel-head"><div><span className="wbs-eyebrow">WBS</span><h2>WBS 执行计划</h2></div></div><p className="project-cockpit-empty">正在读取 WBS 状态…</p></section>;
  }

  if (error || !summary) {
    return <section className="project-cockpit-panel wbs-project-summary"><div className="project-cockpit-panel-head"><div><span className="wbs-eyebrow">WBS</span><h2>WBS 执行计划</h2></div></div><p className="project-cockpit-empty">{error || "WBS 状态暂不可用"}</p></section>;
  }

  if (!summary.template) {
    return (
      <section className="project-cockpit-panel wbs-project-summary">
        <div className="project-cockpit-panel-head"><div><span className="wbs-eyebrow">WBS</span><h2>WBS 执行计划</h2></div></div>
        <div className="project-cockpit-module-summary"><strong>尚未配置全局 WBS 模板</strong><span>先导入一次模板，所有项目都将使用同一套 WBS 任务。</span></div>
        <Link href="/settings/tools#wbs-template" className="project-cockpit-action-link">去导入 WBS 模板</Link>
      </section>
    );
  }

  if (!summary.plan) {
    return (
      <section className="project-cockpit-panel wbs-project-summary">
        <div className="project-cockpit-panel-head"><div><span className="wbs-eyebrow">WBS</span><h2>WBS 执行计划</h2></div><span className="entity-pill entity-pill--muted">未初始化</span></div>
        <div className="project-cockpit-module-summary"><strong>已配置模板 {summary.template.version}</strong><span>当前项目还没有 WBS 执行实例，任务清单与其他项目保持一致。</span></div>
        <Link href={`/projects/${projectId}/wbs`} className="project-cockpit-action-link">初始化项目 WBS</Link>
      </section>
    );
  }

  const gates = GATE_KEYS.map((gateKey) => {
    const nodes = summary.plan?.nodes.filter((node) => node.gateKey === gateKey) ?? [];
    const readiness = deriveStrReadiness(gateKey, nodes.map((node) => ({
      kind: node.kind as "package" | "task" | "gate",
      status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
      requiredDeliverables: node.deliverables.map((deliverable) => ({
        required: deliverable.required,
        status: deliverable.status as "pending" | "delivered",
      })),
    })));
    return { gateKey, readiness };
  });
  const currentGate = gates.find((gate) => gate.readiness.status !== "closed")?.gateKey ?? null;

  return (
    <section className="project-cockpit-panel wbs-project-summary">
      <div className="project-cockpit-panel-head"><div><span className="wbs-eyebrow">WBS</span><h2>WBS 执行摘要</h2></div><Link href={`/projects/${projectId}/wbs`} className="project-cockpit-action-link">打开 WBS 总览</Link></div>
      <div className="wbs-project-summary-meta"><span>统一任务集 {summary.plan.template.version}</span><span>{summary.plan.nodes.length} 个节点</span><span>当前 {currentGate || "全部闭环"}</span></div>
      <div className="wbs-project-summary-grid">{gates.map((gate) => <Link key={gate.gateKey} href={`/projects/${projectId}/wbs/${gate.gateKey}`} aria-current={gate.gateKey === currentGate ? "step" : undefined} className={`wbs-project-summary-card is-${gate.readiness.status}${gate.gateKey === currentGate ? " is-current" : ""}`}><div className="wbs-project-summary-card-head"><strong>{gate.gateKey}</strong>{gate.gateKey === currentGate && <span>当前推进</span>}</div><span>{gate.readiness.completedExecutionNodes}/{gate.readiness.totalExecutionNodes} 完成</span><small>待交付 {gate.readiness.pendingRequiredDeliverables} · {gate.readiness.nextAction || "继续推进"}</small></Link>)}</div>
    </section>
  );
}
