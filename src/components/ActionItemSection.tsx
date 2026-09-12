"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ACTION_ITEM_STATUSES, ACTION_ITEM_STATUS_LABELS } from "@/lib/constants";
import type { ActionItem } from "@/lib/types";
import { getLocalDateString } from "@/lib/utils";

type ActionItemSectionProps = { workItemId?: string; projectId?: string };
type DraftState = { title: string; owner: string };
type ProgressDraft = { note: string; workDate: string };
type RescheduleDraft = { dueDate: string; reason: string; nextStep: string };
type Panel = "edit" | "progress" | "reschedule" | "complete" | undefined;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 6,
  border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 14,
};

function getErrorMessage(errorBody: unknown, fallback: string) {
  if (errorBody && typeof errorBody === "object" && "error" in errorBody) {
    const message = (errorBody as { error?: unknown }).error;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function isOverdueWithoutExplanation(item: ActionItem) {
  if (!item.dueDate || item.status === "done" || item.dueDate >= getLocalDateString()) return false;
  return !(item.progressLogs || []).some((log) => log.workDate > item.dueDate!);
}

export default function ActionItemSection({ workItemId, projectId }: ActionItemSectionProps) {
  const scopeQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (workItemId) params.set("workItemId", workItemId);
    if (projectId) params.set("projectId", projectId);
    return params.toString();
  }, [workItemId, projectId]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [progressDrafts, setProgressDrafts] = useState<Record<string, ProgressDraft>>({});
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, RescheduleDraft>>({});
  const [completionDrafts, setCompletionDrafts] = useState<Record<string, string>>({});
  const [activePanel, setActivePanel] = useState<Record<string, Panel>>({});
  const [newDraft, setNewDraft] = useState({ title: "", owner: "", dueDate: "" });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [showDoneItems, setShowDoneItems] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async (silent = false) => {
    if (!scopeQuery) { setItems([]); setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/action-items?${scopeQuery}`);
      if (!res.ok) throw new Error("Failed to load action items");
      const data = await res.json();
      const nextItems: ActionItem[] = data.actionItems || [];
      setItems(nextItems);
      setDrafts(Object.fromEntries(nextItems.map((item) => [item.id, { title: item.title || "", owner: item.owner || "" }])));
      setError(null);
    } catch (fetchError) {
      console.error("Error fetching action items:", fetchError);
      setError("行动项加载失败");
    } finally { if (!silent) setLoading(false); }
  }, [scopeQuery]);

  useEffect(() => { void loadItems(); }, [loadItems]);
  const setBusy = (id: string, value: boolean) => setBusyMap((prev) => ({ ...prev, [id]: value }));
  const setPanel = (id: string, panel: Panel) => setActivePanel((prev) => ({ ...prev, [id]: panel }));

  const createActionItem = async () => {
    if (creating) return;
    const title = newDraft.title.trim();
    if (!title) { setNotice("请先填写行动项标题。"); return; }
    if (!workItemId) { setNotice("行动项必须关联事项。"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/action-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, owner: newDraft.owner, dueDate: newDraft.dueDate, workItemId, projectId }) });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "创建行动项失败。")); return; }
      setNewDraft({ title: "", owner: "", dueDate: "" }); setShowCreateForm(false); setNotice("行动项已添加。"); await loadItems(true);
    } catch (createError) { console.error("Error creating action item:", createError); setNotice("创建行动项失败。"); }
    finally { setCreating(false); }
  };

  const saveActionItem = async (itemId: string) => {
    const draft = drafts[itemId];
    if (!draft || !draft.title.trim()) { setNotice("行动项标题不能为空。"); return; }
    setBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title.trim(), owner: draft.owner }) });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "保存行动项失败。")); return; }
      setPanel(itemId, undefined); setNotice("行动项已保存。"); await loadItems(true);
    } catch (saveError) { console.error("Error saving action item:", saveError); setNotice("保存行动项失败。"); }
    finally { setBusy(itemId, false); }
  };

  const recordProgress = async (itemId: string) => {
    const draft = progressDrafts[itemId] || { note: "", workDate: getLocalDateString() };
    if (!draft.note.trim()) { setNotice("请填写记录内容。"); return; }
    setBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "记录进展失败。")); return; }
      setPanel(itemId, undefined); setProgressDrafts((prev) => ({ ...prev, [itemId]: { note: "", workDate: getLocalDateString() } })); setNotice("进展已记录，行动项状态保持不变。"); await loadItems(true);
    } catch (progressError) { console.error("Error recording action item progress:", progressError); setNotice("记录进展失败。"); }
    finally { setBusy(itemId, false); }
  };

  const reschedule = async (itemId: string) => {
    const draft = rescheduleDrafts[itemId];
    if (!draft?.dueDate) { setNotice("请选择新的截止日期。"); return; }
    setBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}/reschedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "调整计划失败。")); return; }
      setPanel(itemId, undefined); setNotice("计划已调整，变更事实已记录。"); await loadItems(true);
    } catch (rescheduleError) { console.error("Error rescheduling action item:", rescheduleError); setNotice("调整计划失败。"); }
    finally { setBusy(itemId, false); }
  };

  const complete = async (itemId: string) => {
    setBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completionNote: completionDrafts[itemId] || "" }) });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "完成行动项失败。")); return; }
      setPanel(itemId, undefined); setNotice("行动项已完成。"); await loadItems(true);
    } catch (completeError) { console.error("Error completing action item:", completeError); setNotice("完成行动项失败。"); }
    finally { setBusy(itemId, false); }
  };

  const setActionItemStatus = async (itemId: string, status: string) => {
    if (status === "done") { setPanel(itemId, "complete"); return; }
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || item.status === status) return;
    setBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "行动项状态更新失败。")); return; }
      setNotice("行动项状态已更新。"); await loadItems(true);
    } catch (statusError) { console.error("Error updating action item status:", statusError); setNotice("行动项状态更新失败。"); }
    finally { setBusy(itemId, false); }
  };

  const deleteActionItem = async (itemId: string) => {
    if (!confirm("确定删除这个行动项吗？")) return;
    setBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}`, { method: "DELETE" });
      if (!res.ok) { setNotice(getErrorMessage(await res.json().catch(() => null), "删除行动项失败。")); return; }
      setNotice("行动项已删除。"); await loadItems(true);
    } catch (deleteError) { console.error("Error deleting action item:", deleteError); setNotice("删除行动项失败。"); }
    finally { setBusy(itemId, false); }
  };

  if (!scopeQuery) return null;
  const openItems = items.filter((item) => item.status !== "done");
  const doneItems = items.filter((item) => item.status === "done");
  const visibleItems = showDoneItems ? items : openItems;

  return <section className="form-card action-item-section" style={{ marginBottom: 24 }}>
    <div className="dashboard-section-title"><div><span className="section-eyebrow">ACTION ITEMS</span><h2>行动项</h2></div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span className="section-live"><i />待处理 {openItems.length} / 已处理 {doneItems.length}</span><button type="button" className={`btn ${showDoneItems ? "btn-secondary" : "btn-primary"}`} style={{ fontSize: 12, padding: "6px 12px", fontWeight: 760 }} onClick={() => setShowDoneItems((prev) => !prev)} disabled={doneItems.length === 0}>{showDoneItems ? `隐藏已处理（${doneItems.length}）` : `显示已处理（${doneItems.length}）`}</button>{!showCreateForm && <button type="button" className="btn btn-secondary action-item-add-button" onClick={() => setShowCreateForm(true)}>+ 添加行动项</button>}</div></div>
    {notice && <div className="action-item-notice">{notice}</div>}
    {showCreateForm && <div className="card form-section action-item-create-card" style={{ padding: 16, marginBottom: 12 }}><div style={{ display: "grid", gap: 12 }}><div><div className="detail-field-label">新建行动项</div><input type="text" value={newDraft.title} onChange={(e) => setNewDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="输入待办标题" style={inputStyle} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}><div><div className="detail-field-label">负责人</div><input type="text" value={newDraft.owner} onChange={(e) => setNewDraft((prev) => ({ ...prev, owner: e.target.value }))} placeholder="可选" style={inputStyle} /></div><div><div className="detail-field-label">截止日期</div><input type="date" value={newDraft.dueDate} onChange={(e) => setNewDraft((prev) => ({ ...prev, dueDate: e.target.value }))} style={inputStyle} /></div></div><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={createActionItem} className="btn btn-primary" disabled={creating}>{creating ? "创建中..." : "添加行动项"}</button><button type="button" onClick={() => { setNewDraft({ title: "", owner: "", dueDate: "" }); setShowCreateForm(false); }} className="btn btn-ghost" disabled={creating}>取消</button></div></div></div>}
    {loading ? <div className="card empty-state"><p>加载行动项中...</p></div> : error ? <div className="card empty-state" style={{ gap: 12 }}><p>行动项暂时加载失败，稍后可以重试。</p><div className="field-help">{error}</div><button type="button" className="btn btn-secondary" onClick={() => void loadItems()}>重试</button></div> : visibleItems.length === 0 ? <div className="card empty-state"><p>{items.length === 0 ? "暂无行动项" : "当前没有未处理行动项，已处理内容已折叠。"}</p></div> : <div style={{ display: "grid", gap: 12 }}>{visibleItems.map((item) => {
      const busy = Boolean(busyMap[item.id]); const panel = activePanel[item.id]; const draft = drafts[item.id] || { title: item.title, owner: item.owner || "" }; const overdueWithoutExplanation = isOverdueWithoutExplanation(item); const recentLog = item.progressLogs?.[0]; const progressDraft = progressDrafts[item.id] || { note: "", workDate: getLocalDateString() }; const rescheduleDraft = rescheduleDrafts[item.id] || { dueDate: item.dueDate || "", reason: "", nextStep: "" };
      return <div key={item.id} className={`card form-section action-item-row${item.status === "done" ? " is-done" : ""}`} style={{ padding: 16, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}><div style={{ display: "grid", gap: 12 }}>
        {panel === "edit" ? <><div><div className="detail-field-label">标题</div><input type="text" value={draft.title} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, title: e.target.value } }))} disabled={busy} style={inputStyle} /></div><div><div className="detail-field-label">负责人</div><input type="text" value={draft.owner} onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, owner: e.target.value } }))} disabled={busy} style={inputStyle} /></div><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => void saveActionItem(item.id)} className="btn btn-primary" disabled={busy}>{busy ? "保存中..." : "保存"}</button><button type="button" onClick={() => setPanel(item.id, undefined)} className="btn btn-secondary" disabled={busy}>取消</button></div></> : <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "flex-start" }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: 1.5 }}>{item.title}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>{item.owner && <span>负责人：{item.owner}</span>}{item.dueDate && <span>截止：{item.dueDate}</span>}{item.doneAt && <span>完成：{new Date(item.doneAt).toLocaleDateString("zh-CN")}</span>}</div>{overdueWithoutExplanation && <div style={{ marginTop: 8, color: "var(--accent-red, #c2410c)", fontSize: 12, fontWeight: 700 }}>已逾期 · 缺少延期说明</div>}{recentLog && <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, overflowWrap: "anywhere" }}><strong style={{ color: "var(--text-primary)" }}>最近进展：</strong>{recentLog.note || recentLog.content}</div>}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}><span className={`badge badge-${item.status}`}>{ACTION_ITEM_STATUS_LABELS[item.status] || item.status}</span><button type="button" onClick={() => setPanel(item.id, "edit")} className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy}>编辑</button><button type="button" onClick={() => void deleteActionItem(item.id)} className="btn btn-danger" style={{ fontSize: 12 }} disabled={busy}>{busy ? "处理中..." : "删除"}</button></div></div>
          {panel === "progress" && <div style={{ display: "grid", gap: 8 }}><div className="detail-field-label">记录内容</div><textarea rows={3} value={progressDraft.note} onChange={(e) => setProgressDrafts((prev) => ({ ...prev, [item.id]: { ...progressDraft, note: e.target.value } }))} disabled={busy} placeholder="记录事实、进展或同步结果。" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn btn-primary" onClick={() => void recordProgress(item.id)} disabled={busy}>{busy ? "保存中..." : "保存进展"}</button><button type="button" className="btn btn-secondary" onClick={() => setPanel(item.id, undefined)} disabled={busy}>取消</button></div></div>}
          {panel === "reschedule" && <div style={{ display: "grid", gap: 8 }}><div className="detail-field-label">调整计划</div><input type="date" value={rescheduleDraft.dueDate} onChange={(e) => setRescheduleDrafts((prev) => ({ ...prev, [item.id]: { ...rescheduleDraft, dueDate: e.target.value } }))} disabled={busy} style={inputStyle} />{overdueWithoutExplanation && <><input value={rescheduleDraft.reason} onChange={(e) => setRescheduleDrafts((prev) => ({ ...prev, [item.id]: { ...rescheduleDraft, reason: e.target.value } }))} disabled={busy} placeholder="延期原因（必填）" style={inputStyle} /><input value={rescheduleDraft.nextStep} onChange={(e) => setRescheduleDrafts((prev) => ({ ...prev, [item.id]: { ...rescheduleDraft, nextStep: e.target.value } }))} disabled={busy} placeholder="下一步（必填）" style={inputStyle} /></>}<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn btn-primary" onClick={() => void reschedule(item.id)} disabled={busy}>{busy ? "保存中..." : "保存计划"}</button><button type="button" className="btn btn-secondary" onClick={() => setPanel(item.id, undefined)} disabled={busy}>取消</button></div></div>}
          {panel === "complete" && <div style={{ display: "grid", gap: 8 }}><div className="detail-field-label">完成结果 / 已采取行动（可选）</div><textarea rows={3} value={completionDrafts[item.id] || ""} onChange={(e) => setCompletionDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))} disabled={busy} placeholder="填写后将进入事项时间线。" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn btn-primary" onClick={() => void complete(item.id)} disabled={busy}>{busy ? "保存中..." : "完成行动项"}</button><button type="button" className="btn btn-secondary" onClick={() => setPanel(item.id, undefined)} disabled={busy}>取消</button></div></div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}><button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setProgressDrafts((prev) => ({ ...prev, [item.id]: { note: "", workDate: getLocalDateString() } })); setPanel(item.id, "progress"); }} disabled={busy}>记录进展</button><button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setRescheduleDrafts((prev) => ({ ...prev, [item.id]: { dueDate: item.dueDate || "", reason: "", nextStep: "" } })); setPanel(item.id, "reschedule"); }} disabled={busy || item.status === "done"}>调整计划</button><button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setPanel(item.id, "complete")} disabled={busy || item.status === "done"}>完成</button></div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ACTION_ITEM_STATUSES.filter((status) => status.value !== "done").map((status) => { const active = item.status === status.value; return <button key={status.value} type="button" onClick={() => void setActionItemStatus(item.id, status.value)} disabled={busy || active} style={{ border: "none", cursor: busy || active ? "default" : "pointer", fontSize: 12, padding: "6px 10px", borderRadius: 999, background: active ? "var(--accent-blue)" : "var(--bg-tertiary)", color: active ? "white" : "var(--text-primary)", opacity: busy && !active ? 0.7 : 1 }}>{ACTION_ITEM_STATUS_LABELS[status.value] || status.label}</button>; })}</div>
        </>}
      </div></div>;
    })}</div>}
  </section>;
}
