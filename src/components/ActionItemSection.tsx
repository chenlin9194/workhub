"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ACTION_ITEM_STATUSES, ACTION_ITEM_STATUS_LABELS } from "@/lib/constants";
import type { ActionItem } from "@/lib/types";

type ActionItemSectionProps = {
  workItemId?: string;
  workLogId?: string;
  projectId?: string;
};

type DraftState = {
  title: string;
  status: string;
  owner: string;
  dueDate: string;
};

const EMPTY_DRAFT: DraftState = {
  title: "",
  status: "pending",
  owner: "",
  dueDate: "",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 14,
};

function buildScopeQuery({ workItemId, workLogId, projectId }: ActionItemSectionProps) {
  const params = new URLSearchParams();
  if (workItemId) params.set("workItemId", workItemId);
  if (workLogId) params.set("workLogId", workLogId);
  if (projectId) params.set("projectId", projectId);
  return params.toString();
}

function draftFromItem(item: ActionItem): DraftState {
  return {
    title: item.title || "",
    status: item.status || "pending",
    owner: item.owner || "",
    dueDate: item.dueDate || "",
  };
}

function getErrorMessage(errorBody: unknown, fallback: string) {
  if (errorBody && typeof errorBody === "object" && "error" in errorBody) {
    const message = (errorBody as { error?: unknown }).error;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export default function ActionItemSection({ workItemId, workLogId, projectId }: ActionItemSectionProps) {
  const scopeQuery = useMemo(
    () => buildScopeQuery({ workItemId, workLogId, projectId }),
    [workItemId, workLogId, projectId]
  );
  const [items, setItems] = useState<ActionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [editingMap, setEditingMap] = useState<Record<string, boolean>>({});
  const [newDraft, setNewDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (silent = false) => {
      if (!scopeQuery) {
        setItems([]);
        setDrafts({});
        setEditingMap({});
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const res = await fetch(`/api/action-items?${scopeQuery}`);
        if (!res.ok) {
          throw new Error("Failed to load action items");
        }

        const data = await res.json();
        const nextItems: ActionItem[] = data.actionItems || [];
        setItems(nextItems);
        setDrafts(Object.fromEntries(nextItems.map((item) => [item.id, draftFromItem(item)])));
        setError(null);
      } catch (fetchError) {
        console.error("Error fetching action items:", fetchError);
        setError("Action Items 加载失败");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [scopeQuery]
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const setRowBusy = (itemId: string, value: boolean) => {
    setBusyMap((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const updateDraft = (itemId: string, patch: Partial<DraftState>) => {
    setDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || EMPTY_DRAFT),
        ...patch,
      },
    }));
  };

  const beginEdit = (item: ActionItem) => {
    setDrafts((prev) => ({ ...prev, [item.id]: draftFromItem(item) }));
    setEditingMap((prev) => ({ ...prev, [item.id]: true }));
  };

  const cancelEdit = (item: ActionItem) => {
    setDrafts((prev) => ({ ...prev, [item.id]: draftFromItem(item) }));
    setEditingMap((prev) => ({ ...prev, [item.id]: false }));
  };

  const createActionItem = async () => {
    if (creating) return;

    const title = newDraft.title.trim();
    if (!title) {
      alert("Action Item 标题不能为空");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: newDraft.status,
          owner: newDraft.owner,
          dueDate: newDraft.dueDate,
          workItemId,
          workLogId,
          projectId,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        alert(getErrorMessage(errorBody, "创建 Action Item 失败"));
        return;
      }

      setNewDraft(EMPTY_DRAFT);
      await loadItems(true);
    } catch (createError) {
      console.error("Error creating action item:", createError);
      alert("创建 Action Item 失败");
    } finally {
      setCreating(false);
    }
  };

  const saveActionItem = async (itemId: string) => {
    const draft = drafts[itemId];
    if (!draft) return;

    const title = draft.title.trim();
    if (!title) {
      alert("Action Item 标题不能为空");
      return;
    }

    setRowBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: draft.status,
          owner: draft.owner,
          dueDate: draft.dueDate,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        alert(getErrorMessage(errorBody, "保存 Action Item 失败"));
        return;
      }

      setEditingMap((prev) => ({ ...prev, [itemId]: false }));
      await loadItems(true);
    } catch (saveError) {
      console.error("Error saving action item:", saveError);
      alert("保存 Action Item 失败");
    } finally {
      setRowBusy(itemId, false);
    }
  };

  const setActionItemStatus = async (itemId: string, status: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || item.status === status) return;

    setRowBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        alert(getErrorMessage(errorBody, "更新 Action Item 状态失败"));
        return;
      }

      await loadItems(true);
    } catch (statusError) {
      console.error("Error updating action item status:", statusError);
      alert("更新 Action Item 状态失败");
    } finally {
      setRowBusy(itemId, false);
    }
  };

  const deleteActionItem = async (itemId: string) => {
    if (!confirm("确定删除这个 Action Item 吗？")) return;

    setRowBusy(itemId, true);
    try {
      const res = await fetch(`/api/action-items/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        alert(getErrorMessage(errorBody, "删除 Action Item 失败"));
        return;
      }

      setEditingMap((prev) => ({ ...prev, [itemId]: false }));
      await loadItems(true);
    } catch (deleteError) {
      console.error("Error deleting action item:", deleteError);
      alert("删除 Action Item 失败");
    } finally {
      setRowBusy(itemId, false);
    }
  };

  if (!scopeQuery) {
    return null;
  }

  return (
    <section className="form-card" style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">ACTION ITEMS</span>
          <h2>行动项</h2>
        </div>
        <span className="section-live">
          <i />
          {items.length} 条
        </span>
      </div>

      <div className="card form-section" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>新建行动项</div>
            <input
              type="text"
              value={newDraft.title}
              onChange={(e) => setNewDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="输入待办标题"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>状态</div>
              <select
                value={newDraft.status}
                onChange={(e) => setNewDraft((prev) => ({ ...prev, status: e.target.value }))}
                style={inputStyle}
              >
                {ACTION_ITEM_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>负责人</div>
              <input
                type="text"
                value={newDraft.owner}
                onChange={(e) => setNewDraft((prev) => ({ ...prev, owner: e.target.value }))}
                placeholder="可选"
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>截止日期</div>
              <input
                type="date"
                value={newDraft.dueDate}
                onChange={(e) => setNewDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>新增后会立即保存到当前记录。</span>
            <button
              type="button"
              onClick={createActionItem}
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              disabled={creating}
            >
              {creating ? "创建中..." : "添加行动项"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card empty-state">
          <p>加载行动项中...</p>
        </div>
      ) : error ? (
        <div className="card empty-state" style={{ gap: 12 }}>
          <p style={{ marginBottom: 0 }}>行动项暂时加载失败，稍后可以重试。</p>
          <div className="field-help">{error}</div>
          <button type="button" className="btn btn-secondary" onClick={() => void loadItems()}>
            重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <p>暂无行动项</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => {
            const busy = Boolean(busyMap[item.id]);
            const draft = drafts[item.id] || draftFromItem(item);
            const isEditing = Boolean(editingMap[item.id]);

            return (
              <div
                key={item.id}
                className="card form-section"
                style={{
                  padding: 16,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                }}
              >
                {isEditing ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>标题</div>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => updateDraft(item.id, { title: e.target.value })}
                        disabled={busy}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>状态</div>
                        <select
                          value={draft.status}
                          onChange={(e) => updateDraft(item.id, { status: e.target.value })}
                          disabled={busy}
                          style={inputStyle}
                        >
                          {ACTION_ITEM_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>负责人</div>
                        <input
                          type="text"
                          value={draft.owner}
                          onChange={(e) => updateDraft(item.id, { owner: e.target.value })}
                          disabled={busy}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>截止日期</div>
                        <input
                          type="date"
                          value={draft.dueDate}
                          onChange={(e) => updateDraft(item.id, { dueDate: e.target.value })}
                          disabled={busy}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                        关联：
                        {item.workItemId && <span> 事项</span>}
                        {item.workLogId && <span> 日志</span>}
                        {item.projectId && <span> 项目</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void saveActionItem(item.id)}
                          className="btn btn-primary"
                          style={{ fontSize: 12 }}
                          disabled={busy}
                        >
                          {busy ? "保存中..." : "保存"}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(item)}
                          className="btn btn-secondary"
                          style={{ fontSize: 12 }}
                          disabled={busy}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteActionItem(item.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: 12, color: "var(--accent-red)" }}
                          disabled={busy}
                        >
                          {busy ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, wordBreak: "break-word" }}>
                          {item.title}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                          {item.owner && <span>负责人：{item.owner}</span>}
                          {item.dueDate && <span>截止：{item.dueDate}</span>}
                          {item.doneAt && <span>完成：{new Date(item.doneAt).toLocaleDateString("zh-CN")}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => beginEdit(item)}
                          className="btn btn-secondary"
                          style={{ fontSize: 12 }}
                          disabled={busy}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteActionItem(item.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: 12, color: "var(--accent-red)" }}
                          disabled={busy}
                        >
                          {busy ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ACTION_ITEM_STATUSES.map((status) => {
                        const active = item.status === status.value;
                        return (
                          <button
                            key={status.value}
                            type="button"
                            onClick={() => void setActionItemStatus(item.id, status.value)}
                            disabled={busy || active}
                            style={{
                              border: "none",
                              cursor: busy || active ? "default" : "pointer",
                              fontSize: 12,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: active ? "var(--accent-blue)" : "var(--bg-tertiary)",
                              color: active ? "white" : "var(--text-primary)",
                              opacity: busy && !active ? 0.7 : 1,
                            }}
                          >
                            {ACTION_ITEM_STATUS_LABELS[status.value] || status.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
