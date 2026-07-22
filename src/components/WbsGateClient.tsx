"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { derivePackageStatus, deriveStrReadiness } from "@/lib/wbs/readiness";

type DeliverableView = { id: string; title: string; required: boolean; status: string; evidenceUrl: string | null };
type RelatedItem = { id: string; title: string; status: string };
type NodeView = {
  id: string;
  parentId: string | null;
  kind: string;
  gateKey: string;
  code: string;
  title: string;
  description: string | null;
  role: string | null;
  status: string | null;
  internalCheckDate: string | null;
  completionNote: string | null;
  blockedReason: string | null;
  waiverReason: string | null;
  completedAt: string | null;
  deliverables: DeliverableView[];
  originWorkItems: RelatedItem[];
  milestone: { title: string; targetDate: string | null; status: string; actualDate: string | null; executionWorkItem?: { id: string; title: string; status: string; health: string } | null };
};

type Summary = {
  project: { id: string; name: string };
  plan: { profile: string; template: { version: string }; nodes: NodeView[] } | null;
};

type FilterKey = "all" | "blocked" | "deliverable" | "waived";

const STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "阻塞",
  done: "已完成",
  waived: "已豁免",
};

function dateLabel(value: string | null) {
  return value ? value.replaceAll("-", "/").slice(0, 10) : "—";
}

export default function WbsGateClient({ projectId, gateKey }: { projectId: string; gateKey: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/wbs`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "获取 WBS 执行数据失败");
      setSummary(data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "获取 WBS 执行数据失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const gate = useMemo(() => {
    const nodes = summary?.plan?.nodes.filter((node) => node.gateKey === gateKey) ?? [];
    const review = nodes.find((node) => node.kind === "gate") ?? null;
    const packages = nodes.filter((node) => node.kind === "package");
    const tasks = nodes.filter((node) => node.kind === "task");
    const readiness = deriveStrReadiness(gateKey as "STR1" | "STR2" | "STR3" | "STR4" | "STR4A" | "STR5", nodes.map((node) => ({
      kind: node.kind as "package" | "task" | "gate",
      status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null,
      requiredDeliverables: node.deliverables.map((deliverable) => ({ required: deliverable.required, status: deliverable.status as "pending" | "delivered" })),
    })));
    return { nodes, review, packages, tasks, readiness, milestone: nodes[0]?.milestone };
  }, [gateKey, summary]);

  const roleOptions = useMemo(() => [...new Set([
    ...gate.packages,
    ...gate.tasks,
    ...(gate.review ? [gate.review] : []),
  ].map((node) => node.role?.trim() || "").filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN")), [gate]);
  const visibleTasks = gate.tasks.filter((node) => {
    if (roleFilters.length > 0) return roleFilters.includes(node.role?.trim() || "");
    if (filter === "blocked") return node.status === "blocked";
    if (filter === "deliverable") return node.deliverables.some((deliverable) => deliverable.required && deliverable.status !== "delivered");
    if (filter === "waived") return node.status === "waived";
    return true;
  });

  const updateNode = async (nodeId: string, payload: Record<string, unknown>) => {
    setError("");
    setMessage("");
    const response = await fetch(`/api/projects/${projectId}/wbs/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "更新 WBS 节点失败");
    const warningText = Array.isArray(data.warnings) && data.warnings.length > 0 ? ` ${data.warnings.join("；")}` : "";
    setMessage(`已更新 ${nodeId.slice(-6)}，STR 状态同步为${STATUS_LABELS[data.readiness?.status] || data.readiness?.status || "最新"}。${warningText}`);
    await load();
  };

  if (loading) return <main className="wbs-page"><div className="wbs-panel"><p>正在加载 STR 执行页…</p></div></main>;
  if (error && !summary) return <main className="wbs-page"><div className="wbs-panel wbs-error">{error}</div></main>;
  if (!summary?.plan) return <main className="wbs-page"><div className="wbs-panel"><p>项目尚未初始化 WBS。</p><Link className="btn btn-primary" href={`/projects/${projectId}/wbs`}>去初始化</Link></div></main>;
  if (gate.nodes.length === 0) return <main className="wbs-page"><div className="wbs-panel"><p>未找到 {gateKey} 节点。</p><Link className="btn btn-secondary" href={`/projects/${projectId}/wbs`}>返回 WBS 总览</Link></div></main>;

  return (
    <main className="wbs-page wbs-execution-page">
      <header className="wbs-header">
        <div>
          <Link href={`/projects/${projectId}/wbs`} className="wbs-back">← 返回 WBS 总览</Link>
          <span className="wbs-eyebrow">STR EXECUTION</span>
          <h1>{gateKey} · {gate.milestone?.title || "执行页"}</h1>
          <p>目标日期 {dateLabel(gate.milestone?.targetDate || null)} · STR 事项 {gate.milestone?.executionWorkItem?.status || "未生成"} · 评审任务是本 STR 最后一条必做任务。</p>
        </div>
        <div className={`wbs-readiness-badge is-${gate.readiness.status}`}><strong>{STATUS_LABELS[gate.readiness.status] || gate.readiness.status}</strong><span>{gate.readiness.completedExecutionNodes}/{gate.readiness.totalExecutionNodes} 完成</span></div>
      </header>

      <section className="wbs-panel wbs-execution-toolbar">
        <div className="wbs-filter-tabs"><button type="button" className={filter === "all" && roleFilters.length === 0 ? "is-active" : ""} onClick={() => { setFilter("all"); setRoleFilters([]); }}>全部</button>{(["blocked", "deliverable", "waived"] as FilterKey[]).map((key) => <button type="button" key={key} className={filter === key && roleFilters.length === 0 ? "is-active" : ""} onClick={() => { setFilter(key); setRoleFilters([]); }}>{key === "blocked" ? "阻塞" : key === "deliverable" ? "待交付" : "已豁免"}</button>)}<details className="wbs-role-filter"><summary>按角色 · {roleFilters.length > 0 ? `已选 ${roleFilters.length} 个` : "全部角色"}</summary><div className="wbs-role-menu"><button type="button" onClick={() => { setRoleFilters([]); setFilter("all"); }}>清除角色选择</button>{roleOptions.map((role) => <label key={role}><input type="checkbox" checked={roleFilters.includes(role)} onChange={(event) => { setRoleFilters((current) => event.target.checked ? [...current, role] : current.filter((selectedRole) => selectedRole !== role)); setFilter("all"); }} /><span>{role}</span></label>)}</div></details></div>
        <div className="wbs-readiness-line"><span>待交付物 {gate.readiness.pendingRequiredDeliverables}</span><span>阻塞 {gate.readiness.blockedNodes}</span><span>{gate.readiness.nextAction || "继续推进执行任务"}</span></div>
      </section>

      <section className="wbs-panel">
        <div className="wbs-panel-head"><div><span className="wbs-eyebrow">WORK PACKAGES</span><h2>两层工作包 · {visibleTasks.length} 项显示</h2></div></div>
        <div className="wbs-package-list">
          {gate.packages.map((pkg) => {
            const children = visibleTasks.filter((node) => node.parentId === pkg.id);
            const allChildren = gate.tasks.filter((node) => node.parentId === pkg.id);
            const packageStatus = derivePackageStatus(allChildren.map((node) => ({ kind: "task" as const, status: node.status as "not_started" | "in_progress" | "blocked" | "done" | "waived" | null })));
            if (children.length === 0) return null;
            return <div className="wbs-package" key={pkg.id}><div className="wbs-package-head"><div><strong>{pkg.code} {pkg.title}</strong><span>{pkg.role || "WBS 角色由子任务定义"}</span></div><b className={`is-${packageStatus}`}>{STATUS_LABELS[packageStatus]}</b></div><div className="wbs-task-list">{children.map((node) => <WbsTaskEditor key={node.id} node={node} onUpdate={updateNode} onError={setError} onMessage={setMessage} projectId={projectId} />)}</div></div>;
          })}
          {visibleTasks.length === 0 && <p className="wbs-empty">当前筛选没有匹配任务。</p>}
        </div>
      </section>

      {gate.review && <section className="wbs-panel wbs-review-panel"><div className="wbs-panel-head"><div><span className="wbs-eyebrow">REVIEW GATE</span><h2>{gate.review.code} · {gate.review.title}</h2></div><WbsTaskEditor node={gate.review} onUpdate={updateNode} onError={setError} onMessage={setMessage} projectId={projectId} /></div></section>}
      {message && <p className="wbs-success">{message}</p>}
      {error && <p className="wbs-error">{error}</p>}
    </main>
  );
}

function WbsTaskEditor({
  node,
  onUpdate,
  onError,
  onMessage,
  projectId,
}: {
  node: NodeView;
  onUpdate: (nodeId: string, payload: Record<string, unknown>) => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
  projectId: string;
}) {
  const [status, setStatus] = useState(node.status || "not_started");
  const [completionNote, setCompletionNote] = useState(node.completionNote || "");
  const [blockedReason, setBlockedReason] = useState(node.blockedReason || "");
  const [waiverReason, setWaiverReason] = useState(node.waiverReason || "");
  const [internalCheckDate, setInternalCheckDate] = useState(node.internalCheckDate || "");
  const [deliverables, setDeliverables] = useState(node.deliverables.map((deliverable) => ({ id: deliverable.id, status: deliverable.status, evidenceUrl: deliverable.evidenceUrl || "" })));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(node.status || "not_started");
    setCompletionNote(node.completionNote || "");
    setBlockedReason(node.blockedReason || "");
    setWaiverReason(node.waiverReason || "");
    setInternalCheckDate(node.internalCheckDate || "");
    setDeliverables(node.deliverables.map((deliverable) => ({ id: deliverable.id, status: deliverable.status, evidenceUrl: deliverable.evidenceUrl || "" })));
  }, [node]);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(node.id, { status, completionNote, blockedReason, waiverReason, internalCheckDate, deliverables });
    } catch (nextError) {
      onError(nextError instanceof Error ? nextError.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const splitItem = async () => {
    const title = window.prompt("普通事项标题", node.title);
    if (!title) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/wbs/nodes/${node.id}/split-item`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建普通事项失败");
      onMessage(`已创建普通事项：${data.title}`);
    } catch (nextError) {
      onError(nextError instanceof Error ? nextError.message : "创建普通事项失败");
    }
  };

  return (
    <details className="wbs-task" open={node.status === "blocked"}>
      <summary><span className={`wbs-status-dot is-${node.status || "not_started"}`} /><span className="wbs-task-code">{node.code}</span><strong>{node.title}</strong><small>{node.role || "未设置角色"}</small><b>{STATUS_LABELS[node.status || "not_started"]}</b></summary>
      <div className="wbs-task-body">
        <div className="wbs-task-meta"><span>WBS 角色：{node.role || "未设置"}</span><span>内部检查：{dateLabel(node.internalCheckDate)}</span></div>
        <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="not_started">未开始</option><option value="in_progress">进行中</option><option value="blocked">阻塞</option><option value="done">已完成</option><option value="waived">已豁免</option></select></label>
        <label>完成结论<textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} placeholder="完成任务时必填" rows={2} /></label>
        <label>阻塞原因<textarea value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} placeholder="状态为阻塞时必填" rows={2} /></label>
        <label>豁免原因<textarea value={waiverReason} onChange={(event) => setWaiverReason(event.target.value)} placeholder="状态为已豁免时必填" rows={2} /></label>
        <label>内部检查日期<input type="date" value={internalCheckDate} onChange={(event) => setInternalCheckDate(event.target.value)} /></label>
        {node.deliverables.length > 0 && <div className="wbs-deliverable-list"><strong>交付物</strong>{node.deliverables.map((deliverable, index) => <div key={deliverable.id}><span>{deliverable.required ? "必需" : "可选"} · {deliverable.title}</span><select value={deliverables[index]?.status || deliverable.status} onChange={(event) => setDeliverables((current) => current.map((entry) => entry.id === deliverable.id ? { ...entry, status: event.target.value } : entry))}><option value="pending">待交付</option><option value="delivered">已交付</option></select><input value={deliverables[index]?.evidenceUrl || ""} onChange={(event) => setDeliverables((current) => current.map((entry) => entry.id === deliverable.id ? { ...entry, evidenceUrl: event.target.value } : entry))} placeholder="证据链接（可选）" /></div>)}</div>}
        {node.originWorkItems.length > 0 && <div className="wbs-related-items"><strong>关联普通事项</strong>{node.originWorkItems.map((item) => <Link key={item.id} href={`/items/${item.id}`}>{item.title}<small>{item.status}</small></Link>)}</div>}
        <div className="wbs-task-actions"><button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存节点"}</button>{node.kind === "task" && <button type="button" className="btn btn-secondary" onClick={splitItem}>拆分为普通事项</button>}</div>
      </div>
    </details>
  );
}
