"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WbsProjectProfile } from "@/lib/wbs/constants";
import { deriveStrReadiness } from "@/lib/wbs/readiness";
import type { WbsInitializationPreview } from "@/lib/wbs/types";

type WbsNodeView = {
  id: string;
  kind: string;
  gateKey: string;
  code: string;
  title: string;
  role: string | null;
  status: string | null;
  deliverables: Array<{ id: string; title: string; required: boolean; status: string }>;
  milestone: { title: string; targetDate: string | null; status: string; actualDate: string | null };
};

type WbsSummary = {
  project: { id: string; name: string; type: string };
  plan: {
    id: string;
    profile: string;
    status: string;
    initializedAt: string | null;
    template: { version: string; sourceFileName: string };
    nodes: WbsNodeView[];
  } | null;
};

const PROFILE_LABELS: Record<WbsProjectProfile, string> = {
  tos: "tOS项目",
  tos_major: "tOS大版本",
  device: "整机项目",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "阻塞",
  done: "已完成",
  waived: "已豁免",
};

function dateLabel(value: string | null | undefined) {
  return value ? value.replaceAll("-", "/").slice(0, 10) : "未设置";
}

function readinessFor(gateKey: string, nodes: WbsNodeView[]) {
  return deriveStrReadiness(gateKey as "STR1" | "STR2" | "STR3" | "STR4" | "STR4A" | "STR5", nodes.map((node) => ({
    kind: node.kind as "package" | "task" | "gate",
    status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
    requiredDeliverables: node.deliverables.map((deliverable) => ({
      required: deliverable.required,
      status: deliverable.status as "pending" | "delivered",
    })),
  })));
}

export default function WbsOverviewClient({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<WbsSummary | null>(null);
  const [preview, setPreview] = useState<WbsInitializationPreview | null>(null);
  const [profile, setProfile] = useState<WbsProjectProfile>("tos");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/wbs`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "获取 WBS 摘要失败");
      setSummary(data);
      if (data.plan?.profile && data.plan.profile in PROFILE_LABELS) setProfile(data.plan.profile);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "获取 WBS 摘要失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const loadPreview = async () => {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/wbs/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, version: "V2.0" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成初始化预览失败");
      setPreview(data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "生成初始化预览失败");
    } finally {
      setWorking(false);
    }
  };

  const initialize = async () => {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/wbs/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, version: "V2.0" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "初始化 WBS 失败");
      setMessage(`初始化完成：${data.nodeCount} 个节点，${data.executionItemCreatedCount} 个新 STR 事项。`);
      setPreview(null);
      await loadSummary();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "初始化 WBS 失败");
    } finally {
      setWorking(false);
    }
  };

  const gateCards = useMemo(() => {
    if (!summary?.plan) return [];
    return ["STR1", "STR2", "STR3", "STR4", "STR4A", "STR5"].map((gateKey) => {
      const nodes = summary.plan?.nodes.filter((node) => node.gateKey === gateKey) ?? [];
      const readiness = readinessFor(gateKey, nodes);
      const milestone = nodes[0]?.milestone;
      return { gateKey, nodes, readiness, milestone };
    });
  }, [summary]);
  const currentGate = gateCards.find((gate) => gate.readiness.status !== "closed")?.gateKey || "全部闭环";
  const currentGateIndex = gateCards.findIndex((gate) => gate.gateKey === currentGate);
  const nextGate = currentGateIndex >= 0 ? gateCards[currentGateIndex + 1]?.gateKey || "—" : "—";

  if (loading) return <main className="wbs-page"><div className="wbs-panel"><p>正在加载 WBS…</p></div></main>;
  if (error && !summary) return <main className="wbs-page"><div className="wbs-panel wbs-error">{error}</div></main>;
  if (!summary) return null;

  return (
    <main className="wbs-page">
      <header className="wbs-header">
        <div>
          <Link href={`/projects/${projectId}`} className="wbs-back">← 返回项目驾驶舱</Link>
          <span className="wbs-eyebrow">WORK BREAKDOWN STRUCTURE</span>
          <h1>{summary.project.name} · WBS 总览</h1>
          <p>模板化管理 STR 执行节点；不替换现有项目里程碑和普通事项。</p>
        </div>
        <div className="wbs-header-meta"><span>责任方式</span><strong>按 WBS 角色</strong><small>不映射具体姓名</small></div>
      </header>

      {!summary.plan ? (
        <section className="wbs-panel">
          <div className="wbs-panel-head"><div><span className="wbs-eyebrow">INITIALIZE</span><h2>初始化项目 WBS</h2></div></div>
          <div className="wbs-init-controls">
            <label>项目类型<select value={profile} onChange={(event) => { setProfile(event.target.value as WbsProjectProfile); setPreview(null); }}><option value="tos">{PROFILE_LABELS.tos}</option><option value="tos_major">{PROFILE_LABELS.tos_major}</option><option value="device">{PROFILE_LABELS.device}</option></select></label>
            <button type="button" className="btn btn-secondary" onClick={loadPreview} disabled={working}>{working ? "读取中…" : "查看初始化预览"}</button>
          </div>
          {preview && <InitializationPreview preview={preview} working={working} onInitialize={initialize} />}
        </section>
      ) : (
        <>
          <section className="wbs-panel wbs-plan-meta">
            <div><span>模板</span><strong>{summary.plan.template.version}</strong><small>{summary.plan.template.sourceFileName}</small></div>
            <div><span>项目类型</span><strong>{PROFILE_LABELS[summary.plan.profile as WbsProjectProfile] || summary.plan.profile}</strong><small>已初始化 {dateLabel(summary.plan.initializedAt)}</small></div>
            <div><span>节点</span><strong>{summary.plan.nodes.length}</strong><small>仅在 WBS 页面执行</small></div>
            <div><span>当前 STR</span><strong>{currentGate}</strong><small>按执行状态计算</small></div>
            <div><span>下一 STR</span><strong>{nextGate}</strong><small>前序 STR 闭环后推进</small></div>
            <Link href={`/projects/${projectId}/wbs/STR1`} className="btn btn-primary">进入当前 STR</Link>
          </section>
          <section className="wbs-panel">
            <div className="wbs-panel-head"><div><span className="wbs-eyebrow">STR EXECUTION</span><h2>六个 STR</h2></div><span className="wbs-text-link">重复初始化会复用现有节点</span></div>
            <div className="wbs-gate-grid">
              {gateCards.map((gate) => (
                <Link href={`/projects/${projectId}/wbs/${gate.gateKey}`} key={gate.gateKey} className={`wbs-gate-card is-${gate.readiness.status}`}>
                  <div><strong>{gate.gateKey}</strong><span>{gate.milestone?.title || "未关联里程碑"}</span></div>
                  <b>{STATUS_LABELS[gate.readiness.status] || gate.readiness.status}</b>
                  <small>{gate.readiness.completedExecutionNodes}/{gate.readiness.totalExecutionNodes} 个执行节点完成 · 待交付 {gate.readiness.pendingRequiredDeliverables}</small>
                  <em>{gate.readiness.nextAction || (gate.milestone?.targetDate ? `目标 ${dateLabel(gate.milestone.targetDate)}` : "待安排日期")}</em>
                </Link>
              ))}
            </div>
          </section>
          <section className="wbs-panel wbs-note-panel">
            <span className="wbs-eyebrow">BOUNDARY</span>
            <p>WBS 任务、交付物和 STR 管理事项只在本模块维护。普通事项仍沿用 WorkHub 原有状态、日志和变更记录逻辑。</p>
          </section>
        </>
      )}
      {message && <p className="wbs-success">{message}</p>}
      {error && <p className="wbs-error">{error}</p>}
    </main>
  );
}

function InitializationPreview({
  preview,
  working,
  onInitialize,
}: {
  preview: WbsInitializationPreview;
  working: boolean;
  onInitialize: () => void;
}) {
  return (
    <div className="wbs-preview">
      <div className="wbs-preview-summary"><strong>V2.0 初始化预览</strong><span>{preview.ready ? "六个 STR 均已唯一匹配，可初始化" : "存在冲突，暂不能初始化"}</span></div>
      <div className="wbs-stat-grid"><div><b>{preview.counts.nodes}</b><span>节点</span></div><div><b>{preview.counts.tasks}</b><span>执行任务</span></div><div><b>{preview.counts.deliverables}</b><span>交付物</span></div><div><b>{preview.roleSummary.roleCount}</b><span>WBS 角色</span></div></div>
      <div className="wbs-gate-preview-list">{preview.gates.map((gate) => <div key={gate.gateKey}><strong>{gate.gateKey}</strong><span>{gate.milestoneTitle || "未匹配"}</span><small>{gate.matchedBy || "—"} · {gate.applicableNodeCount} 节点</small></div>)}</div>
      {preview.conflicts.length > 0 && <ul className="wbs-conflict-list">{preview.conflicts.map((conflict) => <li key={`${conflict.code}-${conflict.gateKey}`}>{conflict.message}</li>)}</ul>}
      {preview.ready && <button type="button" className="btn btn-primary" onClick={onInitialize} disabled={working}>{working ? "初始化中…" : "确认初始化"}</button>}
    </div>
  );
}
