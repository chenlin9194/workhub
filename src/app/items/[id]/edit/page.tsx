"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>编辑工作事项</h1>

      <form onSubmit={handleSubmit}>
        <div className="card form-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>标题 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>描述</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>项目选择</label>
                <select
                  value={form.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
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
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>项目名称</label>
                <input
                  type="text"
                  value={form.project}
                  onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
                  placeholder="可手填或由项目选择同步"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>模块</label>
              <select
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                }}
              >
                <option value="">选择模块</option>
                {MODULES.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {WORK_ITEM_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>优先级</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
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
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>负责人</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>截止日期</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>下一步行动</label>
              <textarea
                value={form.nextAction}
                onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>

            <div className="card form-section" style={{ padding: 16, background: "var(--bg-secondary)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>健康度</label>
                    <select
                      value={form.health}
                      onChange={(e) => setForm({ ...form, health: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    >
                      {HEALTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>汇报层级</label>
                    <select
                      value={form.reportLevel}
                      onChange={(e) => setForm({ ...form, reportLevel: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    >
                      {REPORT_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>来源系统</label>
                    <select
                      value={form.sourceSystem}
                      onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    >
                      <option value="">请选择来源系统</option>
                      {SOURCE_SYSTEM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>来源编号</label>
                    <input
                      type="text"
                      value={form.sourceId}
                      onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>来源链接</label>
                    <input
                      type="url"
                      value={form.sourceUrl}
                      onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>当前摘要</label>
                  <textarea
                    value={form.currentSummary}
                    onChange={(e) => setForm({ ...form, currentSummary: e.target.value })}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border-primary)",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: 14,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>跟踪原因</label>
                    <textarea
                      value={form.trackingReason}
                      onChange={(e) => setForm({ ...form, trackingReason: e.target.value })}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                        resize: "vertical",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>下次检查点</label>
                    <input
                      type="date"
                      value={form.nextCheckpoint}
                      onChange={(e) => setForm({ ...form, nextCheckpoint: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>标签</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                }}
              />
            </div>

            <div className="field-actions form-footer">
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                取消
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
