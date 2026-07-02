"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  WORK_ITEM_TYPES,
  PRIORITIES,
  STATUSES,
  MODULES,
  HEALTH_OPTIONS,
  REPORT_LEVEL_OPTIONS,
  SOURCE_SYSTEM_OPTIONS,
} from "@/lib/constants";
import ActionItemDraftSection from "@/components/ActionItemDraftSection";
import type { ActionItemDraft } from "@/lib/types";

interface ProjectOption {
  id: string;
  name: string;
  code?: string | null;
}

function NewItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [actionItemsEnabled, setActionItemsEnabled] = useState(false);
  const [actionItemDrafts, setActionItemDrafts] = useState<ActionItemDraft[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    project: "",
    projectId: initialProjectId,
    module: "",
    type: "action",
    priority: "P2",
    status: "open",
    owner: "",
    dueDate: "",
    nextAction: "",
    tags: "",
    trackingReason: "",
    sourceSystem: "",
    sourceId: "",
    sourceUrl: "",
    health: "unknown",
    currentSummary: "",
    nextCheckpoint: "",
    reportLevel: "none",
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (initialProjectId && projects.length > 0) {
      const proj = projects.find((p) => p.id === initialProjectId);
      if (proj) {
        setForm((prev) => ({ ...prev, project: proj.name }));
      }
    }
  }, [initialProjectId, projects]);

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

  const createActionItems = async (parentItemId: string) => {
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
            workItemId: parentItemId,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!form.title.trim()) {
      alert("标题不能为空");
      return;
    }

    submittingRef.current = true;
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
      submitButtonRef.current.textContent = "保存中...";
    }
    setLoading(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const item = await res.json();
        await createActionItems(item.id);
        window.location.assign(`/items/${item.id}`);
        return;
      }

      const error = await res.json();
      alert(error.error || "保存失败，请重试");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = "创建事项";
      }
      setLoading(false);
    } catch (error) {
      console.error("Error creating item:", error);
      alert("保存失败，请重试");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = "创建事项";
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>新建跟踪事项</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
        事项用于跟踪需要闭环的工作，例如风险、问题、待办、阻塞或跨团队依赖。
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card form-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Title */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                标题 *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="输入事项标题"
                required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                描述
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="输入事项描述"
                rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
              />
            </div>

            {/* Project & Module */}
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

            {/* Module */}
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
                {MODULES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Type, Priority, Status */}
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
                  {WORK_ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  优先级
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  状态
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Owner & Due Date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  责任人
                </label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  placeholder="责任人"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  截止日期
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
            </div>

            {/* Next Action */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                下一步行动
              </label>
              <textarea
                value={form.nextAction}
                onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                placeholder="下一步行动"
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
              />
            </div>

            <div className="card form-section" style={{ padding: 16, background: "var(--bg-secondary)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      健康度
                    </label>
                    <select
                      value={form.health}
                      onChange={(e) => setForm({ ...form, health: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                    >
                      {HEALTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      汇报层级
                    </label>
                    <select
                      value={form.reportLevel}
                      onChange={(e) => setForm({ ...form, reportLevel: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                    >
                      {REPORT_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      来源系统
                    </label>
                    <select
                      value={form.sourceSystem}
                      onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                    >
                      <option value="">请选择来源系统</option>
                      {SOURCE_SYSTEM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      来源编号
                    </label>
                    <input
                      type="text"
                      value={form.sourceId}
                      onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                      placeholder="来源系统中的编号"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                    />
                  </div>
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

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                    当前摘要
                  </label>
                  <textarea
                    value={form.currentSummary}
                    onChange={(e) => setForm({ ...form, currentSummary: e.target.value })}
                    rows={3}
                    placeholder="当前状态、结论或摘要"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      跟踪原因
                    </label>
                    <textarea
                      value={form.trackingReason}
                      onChange={(e) => setForm({ ...form, trackingReason: e.target.value })}
                      rows={3}
                      placeholder="为什么需要跟踪这件事"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      下个检查点
                    </label>
                    <input
                      type="date"
                      value={form.nextCheckpoint}
                      onChange={(e) => setForm({ ...form, nextCheckpoint: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                标签
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="标签（用逗号分隔）"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
              />
            </div>

            <ActionItemDraftSection
              enabled={actionItemsEnabled}
              drafts={actionItemDrafts}
              onEnabledChange={setActionItemsEnabled}
              onDraftsChange={setActionItemDrafts}
            />

            {/* Buttons */}
            <div className="field-actions form-footer">
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                取消
              </button>
              <button ref={submitButtonRef} type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "保存中..." : "创建事项"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>}>
      <NewItemForm />
    </Suspense>
  );
}
