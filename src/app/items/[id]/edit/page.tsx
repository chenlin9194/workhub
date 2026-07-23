"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  WORK_ITEM_TYPES,
  PRIORITIES,
  STATUSES,
  MODULES,
  HEALTH_OPTIONS,
  REPORT_LEVEL_OPTIONS,
  SOURCE_SYSTEM_OPTIONS,
} from "@/lib/constants";

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

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    project: "",
    projectId: "",
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

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=100");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }, []);

  const fetchItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (res.ok) {
        const item = await res.json();
        setForm({
          title: item.title || "",
          description: item.description || "",
          project: item.project || "",
          projectId: item.projectId || "",
          module: item.module || "",
          type: item.type || "action",
          priority: item.priority || "P2",
          status: item.status || "open",
          owner: item.owner || "",
          dueDate: item.dueDate || "",
          nextAction: item.nextAction || "",
          tags: item.tags || "",
          trackingReason: item.trackingReason || "",
          sourceSystem: item.sourceSystem || "",
          sourceId: item.sourceId || "",
          sourceUrl: item.sourceUrl || "",
          health: item.health || "unknown",
          currentSummary: item.currentSummary || "",
          nextCheckpoint: item.nextCheckpoint || "",
          reportLevel: item.reportLevel || "none",
        });
        setShowAdvanced(hasAdvancedItemValues(item));
      } else {
        alert("事项不存在");
        router.push("/items");
      }
    } catch (error) {
      console.error("Error fetching item:", error);
    } finally {
      setFetching(false);
    }
  }, [id, router]);

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!form.projectId) {
      return;
    }

    const project = projects.find((option) => option.id === form.projectId);
    if (!project) {
      return;
    }

    setForm((prev) => (prev.project === project.name ? prev : { ...prev, project: project.name }));
  }, [form.projectId, projects]);

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((option) => option.id === projectId);
    if (project) {
      setForm((prev) => ({ ...prev, projectId, project: project.name }));
      return;
    }

    setForm((prev) => ({ ...prev, projectId: "", project: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!form.title.trim()) {
      alert("标题不能为空");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        router.refresh();
        router.push(`/items/${id}`);
        return;
      }

      const error = await res.json();
      alert(error.error || "保存失败，请重试");
    } catch (error) {
      console.error("Error updating item:", error);
      alert("保存失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="page-shell command-form-page">
        <div className="card form-card command-form-card command-form-message">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell command-form-page item-edit-page">
      <header className="command-form-header">
        <Link href={`/items/${id}`} className="detail-back-link">
          ← 返回事项详情
        </Link>
        <div>
          <span className="section-eyebrow">COMMAND FORM / ITEM</span>
          <h1>编辑事项</h1>
          <p>优先更新状态、责任、截止日期和下一步行动；完整属性可在下方继续维护。</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="card form-card command-form-card item-command-form-card">
          <div className="command-form-stack">
            <section className="command-form-section item-form-section-main item-form-section-metadata">
              <div className="command-form-section-header">
                <h2>基础属性</h2>
                <p>标题是事项的核心识别信息。</p>
              </div>

              <div>
                <label className="form-field-label">标题 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="form-field-control"
                />
              </div>

            </section>

            <section className="command-form-section item-form-section-side item-form-section-metadata-side">
              <div className="command-form-section-header">
                <h2>关联与分类</h2>
                <p>先确认事项所属项目。</p>
              </div>

                <div>
                  <label className="form-field-label">项目选择</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="form-field-control"
                  >
                    <option value="">无关联项目</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {project.code ? ` (${project.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
            </section>

            <section className="command-form-section item-form-section-status item-form-section-operational">
              <div className="command-form-section-header">
                <h2>运营更新</h2>
                <p>高频维护：状态、优先级、负责人和截止日期。</p>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">类型</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="form-field-control"
                  >
                    {WORK_ITEM_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
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
                    {PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
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
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
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

            <section className="command-form-section item-form-section-signal item-form-section-operational-signal">
              <div className="command-form-section-header">
                <h2>执行信号</h2>
                <p>下一步行动和下一检查点决定后续处理节奏。</p>
              </div>

              <div>
                <label className="form-field-label">下一步行动</label>
                <textarea
                  value={form.nextAction}
                  onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                  rows={3}
                  className="form-field-control form-field-textarea"
                />
                <div className="field-note">用于概括当前最重要的一步；具体执行记录请沉淀到行动项。</div>
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
                      onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
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
                      {MODULES.map((module) => <option key={module} value={module}>{module}</option>)}
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
                      className="form-field-control"
                    />
                  </div>
                  <div>
                    <label className="form-field-label">来源链接</label>
                    <input
                      type="url"
                      value={form.sourceUrl}
                      onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
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
                      className="form-field-control form-field-textarea"
                    />
                  </div>
                  <div>
                    <label className="form-field-label">跟踪原因</label>
                    <textarea
                      value={form.trackingReason}
                      onChange={(e) => setForm({ ...form, trackingReason: e.target.value })}
                      rows={3}
                      className="form-field-control form-field-textarea"
                    />
                  </div>
                </div>
              </div>
            </details>

            <div className="command-form-actions">
              <span className="field-note">保存后会同步到事项详情页。</span>
              <div className="command-form-actions-main">
                <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "保存中..." : "保存事项"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
