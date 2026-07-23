"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import ActionItemDraftSection, { createActionItemDraft } from "@/components/ActionItemDraftSection";
import type { ActionItemDraft } from "@/lib/types";

interface ProjectOption {
  id: string;
  name: string;
  code?: string | null;
}

function hasAdvancedItemValues(value: {
  description?: string | null;
  module?: string | null;
  tags?: string | null;
  health?: string | null;
  reportLevel?: string | null;
  sourceSystem?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  currentSummary?: string | null;
  trackingReason?: string | null;
}) {
  return Boolean(
    value.description ||
      value.module ||
      value.tags ||
      (value.health && value.health !== "unknown") ||
      (value.reportLevel && value.reportLevel !== "none") ||
      value.sourceSystem ||
      value.sourceId ||
      value.sourceUrl ||
      value.currentSummary ||
      value.trackingReason
  );
}

function NewItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";
  const initialActionItemsEnabled = searchParams.get("actionItems") === "1";
  const initialAdvancedOpen = hasAdvancedItemValues({
    description: searchParams.get("description"),
    module: searchParams.get("module"),
    tags: searchParams.get("tags"),
    health: searchParams.get("health"),
    reportLevel: searchParams.get("reportLevel"),
    sourceSystem: searchParams.get("sourceSystem"),
    sourceId: searchParams.get("sourceId"),
    sourceUrl: searchParams.get("sourceUrl"),
    currentSummary: searchParams.get("currentSummary"),
    trackingReason: searchParams.get("trackingReason"),
  });

  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(initialAdvancedOpen);
  const submittingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [actionItemsEnabled, setActionItemsEnabled] = useState(initialActionItemsEnabled);
  const [actionItemDrafts, setActionItemDrafts] = useState<ActionItemDraft[]>(() =>
    initialActionItemsEnabled ? [createActionItemDraft()] : []
  );
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
      const actionItems = actionItemsEnabled
        ? actionItemDrafts
            .filter((draft) => draft.title.trim())
            .map((draft, index) => ({
              title: draft.title.trim(),
              status: draft.status,
              owner: draft.owner,
              dueDate: draft.dueDate,
              sortOrder: index,
            }))
        : [];
      const res = await fetch("/api/items/with-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, actionItems }),
      });

      if (res.ok) {
        const { item } = await res.json();
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
    <div className="page-shell command-form-page item-create-page">
      <header className="command-form-header">
        <Link href="/items" className="detail-back-link">
          ← 返回事项列表
        </Link>
        <div>
          <span className="section-eyebrow">COMMAND FORM / ITEM</span>
          <h1>新建事项</h1>
          <p>录入需要跟踪的交付信号，保持信息密度紧凑，便于快速扫读和后续汇报。</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="card form-card command-form-card item-command-form-card">
          <div className="command-form-stack">
            <section className="command-form-section item-form-section-main item-form-section-intake">
              <div className="command-form-section-header">
                <h2>快速录入</h2>
                <p>先记录标题、归属和处理节奏，其他信息可稍后补齐。</p>
              </div>

              <div>
                <label className="form-field-label">标题 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="输入事项标题"
                  required
                  className="form-field-control"
                />
              </div>

            </section>

            <section className="command-form-section item-form-section-side item-form-section-context">
              <div className="command-form-section-header">
                <h2>归属信息</h2>
                <p>先选择需要持续跟踪的项目。</p>
              </div>

              <div>
                <label className="form-field-label">项目</label>
                <select
                  value={form.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="form-field-control"
                >
                  <option value="">选择已有项目（可选）</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.code ? ` (${p.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="command-form-section item-form-section-status item-form-section-critical">
              <div className="command-form-section-header">
                <h2>处理优先级</h2>
                <p>优先级、状态、负责人和截止日期决定后续处理节奏。</p>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">类型</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="form-field-control"
                  >
                    {WORK_ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-field-label">优先级</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="form-field-control"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-field-label">状态</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="form-field-control"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-grid-2">
                <div>
                  <label className="form-field-label">负责人</label>
                  <input
                    type="text"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    placeholder="可选"
                    className="form-field-control"
                  />
                </div>
                <div>
                  <label className="form-field-label">截止日期</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="form-field-control"
                  />
                </div>
              </div>
            </section>

            <section className="command-form-section item-form-section-signal item-form-section-supplement">
              <div className="command-form-section-header">
                <h2>执行信号</h2>
                <p>下一步行动和下一检查点决定后续处理节奏。</p>
              </div>

              <div>
                <label className="form-field-label">下一步行动</label>
                <textarea
                  value={form.nextAction}
                  onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                  placeholder="下一步行动"
                  rows={3}
                  className="form-field-control form-field-textarea"
                />
              </div>

              <div>
                <label className="form-field-label">下一检查点</label>
                <input
                  type="date"
                  value={form.nextCheckpoint}
                  onChange={(e) => setForm({ ...form, nextCheckpoint: e.target.value })}
                  className="form-field-control"
                />
              </div>
            </section>

            <details
              className="item-form-advanced"
              open={showAdvanced}
              onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
            >
              <summary>
                <strong>更多信息</strong>
                <span>描述、模块、标签、健康度、来源与补充字段</span>
              </summary>
              <div className="item-form-advanced-content">
                <div>
                  <label className="form-field-label">详细描述</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="输入事项描述"
                    rows={4}
                    className="form-field-control form-field-textarea"
                  />
                </div>

                <div className="field-grid-2">
                  <div>
                    <label className="form-field-label">项目名称</label>
                    <input
                      type="text"
                      value={form.project}
                      onChange={(e) => setForm({ ...form, project: e.target.value })}
                      placeholder="无项目 ID 时可手填"
                      className="form-field-control"
                    />
                  </div>
                  <div>
                    <label className="form-field-label">模块</label>
                    <select
                      value={form.module}
                      onChange={(e) => setForm({ ...form, module: e.target.value })}
                      className="form-field-control"
                    >
                      <option value="">选择模块</option>
                      {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-field-label">标签</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="标签，用逗号分隔"
                    className="form-field-control"
                  />
                </div>

                <div className="field-grid-3">
                  <div>
                    <label className="form-field-label">健康度</label>
                    <select
                      value={form.health}
                      onChange={(e) => setForm({ ...form, health: e.target.value })}
                      className="form-field-control"
                    >
                      {HEALTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-field-label">汇报层级</label>
                    <select
                      value={form.reportLevel}
                      onChange={(e) => setForm({ ...form, reportLevel: e.target.value })}
                      className="form-field-control"
                    >
                      {REPORT_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-field-label">来源系统</label>
                    <select
                      value={form.sourceSystem}
                      onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })}
                      className="form-field-control"
                    >
                      <option value="">选择来源系统</option>
                      {SOURCE_SYSTEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field-grid-2">
                  <div>
                    <label className="form-field-label">来源编号</label>
                    <input
                      type="text"
                      value={form.sourceId}
                      onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                      placeholder="来源系统中的编号"
                      className="form-field-control"
                    />
                  </div>
                  <div>
                    <label className="form-field-label">来源链接</label>
                    <input
                      type="url"
                      value={form.sourceUrl}
                      onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                      placeholder="https://..."
                      className="form-field-control"
                    />
                  </div>
                </div>

                <div className="field-grid-2">
                  <div>
                    <label className="form-field-label">当前摘要</label>
                    <textarea
                      value={form.currentSummary}
                      onChange={(e) => setForm({ ...form, currentSummary: e.target.value })}
                      rows={3}
                      placeholder="当前状态、结论或摘要"
                      className="form-field-control form-field-textarea"
                    />
                  </div>
                  <div>
                    <label className="form-field-label">跟踪原因</label>
                    <textarea
                      value={form.trackingReason}
                      onChange={(e) => setForm({ ...form, trackingReason: e.target.value })}
                      rows={3}
                      placeholder="为什么需要跟踪这件事"
                      className="form-field-control form-field-textarea"
                    />
                  </div>
                </div>
              </div>
            </details>

            <div className="item-form-section-wide">
              <ActionItemDraftSection
                enabled={actionItemsEnabled}
                drafts={actionItemDrafts}
                onEnabledChange={setActionItemsEnabled}
                onDraftsChange={setActionItemDrafts}
                title="后续行动"
                description="可选：保存后补充几个需要跟进的行动项。"
              />
            </div>

            <div className="command-form-actions">
              <span className="field-note">保存后会进入事项详情页。</span>
              <div className="command-form-actions-main">
                <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                  取消
                </button>
                <button ref={submitButtonRef} type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "保存中..." : "创建事项"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={<div className="command-form-message">加载中...</div>}>
      <NewItemForm />
    </Suspense>
  );
}
