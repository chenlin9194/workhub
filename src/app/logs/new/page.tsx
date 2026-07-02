"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MODULES, PRIORITIES, SOURCES, STATUSES, WORK_ITEM_TYPES, WORK_LOG_TYPES } from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import Icon from "@/components/Icon";
import ActionItemDraftSection from "@/components/ActionItemDraftSection";
import type { ActionItemDraft } from "@/lib/types";

type RelationMode = "none" | "existing" | "new";

interface ExistingItem {
  id: string;
  title: string;
  projectId?: string | null;
  project?: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  code?: string | null;
}

function NewLogForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get("itemId") || "";
  const initialProjectId = searchParams.get("projectId") || "";

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<ExistingItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [actionItemsEnabled, setActionItemsEnabled] = useState(false);
  const [actionItemDrafts, setActionItemDrafts] = useState<ActionItemDraft[]>([]);
  const [form, setForm] = useState({
    workDate: getLocalDateString(),
    title: "",
    content: "",
    type: "note",
    source: "manual",
    project: "",
    projectId: initialProjectId,
    module: "",
    tags: "",
    reportable: false,
    sourceUrl: "",
    relationMode: initialItemId ? ("existing" as RelationMode) : ("none" as RelationMode),
    itemId: initialItemId,
    newType: "action",
    newPriority: "P2",
    newStatus: "open",
    newOwner: "",
    newDueDate: "",
    newNextAction: "",
  });

  useEffect(() => {
    fetchItems();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!form.projectId) {
      return;
    }

    const proj = projects.find((p) => p.id === form.projectId);
    if (!proj) {
      return;
    }

    setForm((prev) => (prev.project === proj.name ? prev : { ...prev, project: proj.name }));
  }, [form.projectId, projects]);

  useEffect(() => {
    if (initialItemId) {
      setForm((prev) => ({
        ...prev,
        relationMode: "existing",
        itemId: initialItemId,
      }));
    }
  }, [initialItemId]);

  useEffect(() => {
    if (!initialItemId || initialProjectId) {
      return;
    }

    const linkedItem = items.find((item) => item.id === initialItemId);
    if (!linkedItem) {
      return;
    }

    const nextProjectId = linkedItem.projectId || "";
    const nextProjectName =
      (linkedItem.projectId ? projects.find((project) => project.id === linkedItem.projectId)?.name : "") ||
      linkedItem.project ||
      "";

    if (!nextProjectId && !nextProjectName) {
      return;
    }

    setForm((prev) => {
      const nextState = { ...prev };

      if (nextProjectId && prev.projectId !== nextProjectId) {
        nextState.projectId = nextProjectId;
      }

      if (nextProjectName && prev.project !== nextProjectName) {
        nextState.project = nextProjectName;
      }

      return nextState;
    });
  }, [initialItemId, initialProjectId, items, projects]);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/items?pageSize=100");
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects?pageSize=100");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const handleProjectChange = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setForm({ ...form, projectId, project: proj.name });
    } else {
      setForm({ ...form, projectId: "" });
    }
  };

  const createActionItems = async (workLogId: string, workItemId?: string | null) => {
    const activeDrafts = actionItemsEnabled
      ? actionItemDrafts.filter((draft) => draft.title.trim())
      : [];

    if (activeDrafts.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      activeDrafts.map((draft, index) =>
        fetch("/api/action-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title.trim(),
            status: draft.status,
            owner: draft.owner,
            dueDate: draft.dueDate,
            workLogId,
            workItemId: workItemId || undefined,
            projectId: form.projectId || undefined,
            sortOrder: index,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const errorBody = await res.json().catch(() => null);
            throw new Error(errorBody?.error || "创建 Action Item 失败");
          }

          return res.json();
        })
      )
    );

    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      alert(`父记录已保存，但有 ${failures.length} 条 Action Item 创建失败`);
    }
  };

  const handleItemChange = (itemId: string) => {
    const selectedItem = items.find((item) => item.id === itemId);

    setForm((prev) => {
      const nextState = { ...prev, itemId };

      if (!initialProjectId && selectedItem) {
        if (selectedItem.projectId) {
          nextState.projectId = selectedItem.projectId;
          nextState.project =
            projects.find((project) => project.id === selectedItem.projectId)?.name ||
            selectedItem.project ||
            "";
        } else if (selectedItem.project) {
          nextState.project = selectedItem.project;
        }
      }

      return nextState;
    });
  };

  const removeCreatedItem = async (itemId: string) => {
    try {
      await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error rolling back created item:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!form.title.trim() || !form.content.trim()) {
      alert("标题和内容不能为空");
      return;
    }

    if (form.relationMode === "existing" && !form.itemId) {
      alert("请选择要关联的已有事项");
      return;
    }

    submittingRef.current = true;
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
      submitButtonRef.current.textContent = "创建中...";
    }
    setLoading(true);
    let createdItemId: string | null = null;
    let shouldRestoreSubmit = true;

    try {
      let itemIdToLink: string | null = null;

      if (form.relationMode === "new") {
        const itemRes = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(),
            project: form.project,
            projectId: form.projectId || undefined,
            module: form.module,
            type: form.newType,
            tags: form.tags,
            priority: form.newPriority,
            status: form.newStatus,
            owner: form.newOwner,
            dueDate: form.newDueDate,
            nextAction: form.newNextAction,
          }),
        });

        if (!itemRes.ok) {
          const error = await itemRes.json();
          alert(error.error || "保存失败，请重试");
          submittingRef.current = false;
          if (submitButtonRef.current) {
            submitButtonRef.current.disabled = false;
            submitButtonRef.current.textContent = submitLabel;
          }
          setLoading(false);
          return;
        }

        const item = await itemRes.json();
        createdItemId = item.id;
        itemIdToLink = item.id;
      } else if (form.relationMode === "existing") {
        itemIdToLink = form.itemId || null;
      }

      const logRes = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: form.workDate,
          title: form.title.trim(),
          content: form.content.trim(),
          type: form.type,
          source: form.source,
          project: form.project,
          projectId: form.projectId || undefined,
          module: form.module,
          tags: form.tags,
          reportable: form.reportable,
          sourceUrl: form.sourceUrl,
          itemId: itemIdToLink,
        }),
      });

      if (logRes.ok) {
        const log = await logRes.json();
        await createActionItems(log.id, itemIdToLink);
        shouldRestoreSubmit = false;
        window.location.assign(`/logs/${log.id}`);
        return;
      }

      if (createdItemId) {
        await removeCreatedItem(createdItemId);
      }

      const error = await logRes.json();
      alert(error.error || "保存失败，请重试");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = submitLabel;
      }
    } catch (error) {
      console.error("Error creating log:", error);
      if (createdItemId) {
        await removeCreatedItem(createdItemId);
      }
      alert("保存失败，请重试");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = submitLabel;
      }
      setLoading(false);
    } finally {
      if (shouldRestoreSubmit) {
        setLoading(false);
      }
    }
  };

  const submitLabel = form.relationMode === "new" ? "先创建事项并保存日志" : "创建日志";

  return (
    <div className="log-entry-page">
      <header className="command-page-header log-entry-header">
        <div>
          <span className="section-eyebrow">CAPTURE TODAY&apos;S SIGNALS</span>
          <h1>记录今日进展</h1>
          <p>日志记录今天发生的事实；需要持续跟进时再关联事项。</p>
        </div>
        <span className="capture-status"><i />FACT CAPTURE</span>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="card log-entry-card form-card">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="log-date-row">
              <div className="log-date-field">
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  工作日期 *
                </label>
                <input
                  type="date"
                  value={form.workDate}
                  onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                  required
                  className="input"
                />
              </div>
            </div>

            <fieldset className="relation-fieldset">
              <legend>关联方式</legend>
              <div className="relation-mode-grid">
                {([
                  { value: "none", title: "不关联事项", description: "只记录事实，保持轻量", icon: "file-text" },
                  { value: "existing", title: "关联已有事项", description: "把进展归入正在跟踪的事项", icon: "target" },
                  { value: "new", title: "创建新事项并关联", description: "记录事实并立即建立闭环", icon: "plus" },
                ] as const).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    className={`relation-mode-card${form.relationMode === mode.value ? " is-selected" : ""}`}
                    aria-pressed={form.relationMode === mode.value}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        relationMode: mode.value,
                        itemId: mode.value === "existing" ? prev.itemId : "",
                      }))
                    }
                  >
                    <span className="relation-mode-icon"><Icon name={mode.icon} size={18} /></span>
                    <span><strong>{mode.title}</strong><small>{mode.description}</small></span>
                    <i className="relation-check"><Icon name="check-circle" size={15} /></i>
                  </button>
                ))}
              </div>
            </fieldset>

            {form.relationMode === "existing" && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  选择已有事项
                </label>
                <select
                  value={form.itemId}
                  onChange={(e) => handleItemChange(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                  disabled={items.length === 0}
                >
                  <option value="">{items.length === 0 ? "当前没有可关联事项" : "请选择已有事项"}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.relationMode === "new" && (
              <div className="card form-section" style={{ padding: 16, background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>新事项信息</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      新事项将继承本条日志的标题、项目、模块和标签，用于跟踪需要闭环的风险、问题、待办或跨团队依赖。
                    </p>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      事项类型
                    </label>
                    <select
                      value={form.newType}
                      onChange={(e) => setForm({ ...form, newType: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                    >
                      {WORK_ITEM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        优先级
                      </label>
                      <select
                        value={form.newPriority}
                        onChange={(e) => setForm({ ...form, newPriority: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        状态
                      </label>
                      <select
                        value={form.newStatus}
                        onChange={(e) => setForm({ ...form, newStatus: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      >
                        {STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        负责人
                      </label>
                      <input
                        type="text"
                        value={form.newOwner}
                        onChange={(e) => setForm({ ...form, newOwner: e.target.value })}
                        placeholder="可选"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        截止日期
                      </label>
                      <input
                        type="date"
                        value={form.newDueDate}
                        onChange={(e) => setForm({ ...form, newDueDate: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      下一步行动
                    </label>
                    <textarea
                      value={form.newNextAction}
                      onChange={(e) => setForm({ ...form, newNextAction: e.target.value })}
                      placeholder="可选"
                      rows={3}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                标题 *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="输入日志标题，新事项会继承这个标题"
                required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                内容 *
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="粘贴飞书消息、会议结论、问题进展、临时想法……"
                rows={11}
                required
                className="input log-content-input"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  类型
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {WORK_LOG_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  来源
                </label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {SOURCES.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  模块
                </label>
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  <option value="">选择模块</option>
                  {MODULES.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ActionItemDraftSection
              enabled={actionItemsEnabled}
              drafts={actionItemDrafts}
              onEnabledChange={setActionItemsEnabled}
              onDraftsChange={setActionItemDrafts}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  项目
                </label>
                <select
                  value={form.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  <option value="">选择已有项目（可选）</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.code ? ` (${p.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  项目名称
                </label>
                <input
                  type="text"
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  placeholder="手填项目名称"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  标签
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="标签，用逗号分隔"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label className="field-checkbox">
                <input
                  type="checkbox"
                  checked={form.reportable}
                  onChange={(e) => setForm({ ...form, reportable: e.target.checked })}
                />
                可汇报
              </label>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  来源链接
                </label>
                <input
                  type="url"
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  placeholder="https://..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
            </div>

            <div className="field-actions form-footer">
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                取消
              </button>
              <button ref={submitButtonRef} type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "创建中..." : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewLogPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>}>
      <NewLogForm />
    </Suspense>
  );
}
