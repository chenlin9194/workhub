"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import {
  PROJECT_MILESTONE_STATUSES,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_PLAN_TYPES,
  PROJECT_PLAN_TYPE_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { ProjectMilestone } from "@/lib/types";

type MilestoneFormState = {
  title: string;
  description: string;
  status: string;
  planType: string;
  targetDate: string;
  actualDate: string;
  owner: string;
  sourceUrl: string;
  sortOrder: string;
};

const EMPTY_MILESTONE_FORM: MilestoneFormState = {
  title: "",
  description: "",
  status: "planned",
  planType: "milestone",
  targetDate: "",
  actualDate: "",
  owner: "",
  sourceUrl: "",
  sortOrder: "0",
};

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  return formatDate(value, "iso");
}

type ProjectMilestoneSectionProps = {
  projectId: string;
};

export default function ProjectMilestoneSection({ projectId }: ProjectMilestoneSectionProps) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesError, setMilestonesError] = useState(false);
  const [milestoneActionError, setMilestoneActionError] = useState("");
  const [showMilestoneCreateForm, setShowMilestoneCreateForm] = useState(false);
  const [milestoneCreateSaving, setMilestoneCreateSaving] = useState(false);
  const [milestoneCreateError, setMilestoneCreateError] = useState("");
  const [milestoneCreateForm, setMilestoneCreateForm] = useState<MilestoneFormState>(EMPTY_MILESTONE_FORM);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneEditSaving, setMilestoneEditSaving] = useState(false);
  const [milestoneEditError, setMilestoneEditError] = useState("");
  const [milestoneEditForm, setMilestoneEditForm] = useState<MilestoneFormState>(EMPTY_MILESTONE_FORM);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [selectedPlanType, setSelectedPlanType] = useState("all");

  const validateMilestoneForm = useCallback((form: MilestoneFormState) => {
    if (!form.title.trim()) {
      return "里程碑名称不能为空";
    }

    return "";
  }, []);

  const buildMilestonePayload = useCallback((form: MilestoneFormState) => {
    const sortOrderValue = Number(form.sortOrder);

    return {
      title: form.title.trim(),
      description: form.description,
      status: form.status.trim() || "planned",
      planType: form.planType.trim() || "milestone",
      targetDate: form.targetDate || null,
      actualDate: form.actualDate || null,
      owner: form.owner,
      sourceUrl: form.sourceUrl,
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
    };
  }, []);

  const resetMilestoneCreateForm = useCallback(() => {
    setMilestoneCreateForm(EMPTY_MILESTONE_FORM);
    setMilestoneCreateError("");
  }, []);

  const resetMilestoneEditForm = useCallback(() => {
    setMilestoneEditForm(EMPTY_MILESTONE_FORM);
    setMilestoneEditError("");
  }, []);

  const fetchMilestones = useCallback(async () => {
    try {
      setMilestonesLoading(true);
      setMilestonesError(false);

      const res = await fetch(`/api/projects/${projectId}/milestones`);
      if (res.ok) {
        const data = await res.json();
        setMilestones(data);
      } else {
        setMilestones([]);
        setMilestonesError(true);
      }
    } catch (error) {
      console.error("Error fetching project milestones:", error);
      setMilestones([]);
      setMilestonesError(true);
    } finally {
      setMilestonesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const openMilestoneCreateForm = () => {
    resetMilestoneEditForm();
    setEditingMilestoneId(null);
    setMilestoneActionError("");
    resetMilestoneCreateForm();
    setShowMilestoneCreateForm(true);
  };

  const closeMilestoneCreateForm = () => {
    resetMilestoneCreateForm();
    setShowMilestoneCreateForm(false);
  };

  const openMilestoneEditForm = (milestone: ProjectMilestone) => {
    closeMilestoneCreateForm();
    setMilestoneActionError("");
    setEditingMilestoneId(milestone.id);
    setMilestoneEditError("");
    setMilestoneEditForm({
      title: milestone.title,
      description: milestone.description || "",
      status: milestone.status,
      planType: milestone.planType || "milestone",
      targetDate: toDateInputValue(milestone.targetDate),
      actualDate: toDateInputValue(milestone.actualDate),
      owner: milestone.owner || "",
      sourceUrl: milestone.sourceUrl || "",
      sortOrder: String(milestone.sortOrder),
    });
  };

  const closeMilestoneEditForm = () => {
    resetMilestoneEditForm();
    setEditingMilestoneId(null);
  };

  const handleMilestoneCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (milestoneCreateSaving) return;

    const validationError = validateMilestoneForm(milestoneCreateForm);
    if (validationError) {
      setMilestoneCreateError(validationError);
      return;
    }

    setMilestoneCreateSaving(true);
    setMilestoneCreateError("");
    setMilestoneActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMilestonePayload(milestoneCreateForm)),
      });

      if (!res.ok) {
        setMilestoneCreateError("保存项目里程碑失败");
        return;
      }

      closeMilestoneCreateForm();
      await fetchMilestones();
    } catch (error) {
      console.error("Error creating project milestone:", error);
      setMilestoneCreateError("保存项目里程碑失败");
    } finally {
      setMilestoneCreateSaving(false);
    }
  };

  const handleMilestoneEditSubmit = async (e: React.FormEvent, milestoneId: string) => {
    e.preventDefault();
    if (milestoneEditSaving) return;

    const validationError = validateMilestoneForm(milestoneEditForm);
    if (validationError) {
      setMilestoneEditError(validationError);
      return;
    }

    setMilestoneEditSaving(true);
    setMilestoneEditError("");
    setMilestoneActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMilestonePayload(milestoneEditForm)),
      });

      if (!res.ok) {
        setMilestoneEditError("更新项目里程碑失败");
        return;
      }

      closeMilestoneEditForm();
      await fetchMilestones();
    } catch (error) {
      console.error("Error updating project milestone:", error);
      setMilestoneEditError("更新项目里程碑失败");
    } finally {
      setMilestoneEditSaving(false);
    }
  };

  const handleMilestoneDelete = async (milestoneId: string) => {
    if (deletingMilestoneId) return;
    if (!confirm("确认删除这个项目里程碑吗？")) return;

    setDeletingMilestoneId(milestoneId);
    setMilestoneActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setMilestoneActionError("删除项目里程碑失败");
        return;
      }

      if (editingMilestoneId === milestoneId) {
        closeMilestoneEditForm();
      }

      await fetchMilestones();
    } catch (error) {
      console.error("Error deleting project milestone:", error);
      setMilestoneActionError("删除项目里程碑失败");
    } finally {
      setDeletingMilestoneId(null);
    }
  };

  const filteredMilestones =
    selectedPlanType === "all"
      ? milestones
      : milestones.filter((milestone) => (milestone.planType || "milestone") === selectedPlanType);

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">MILESTONES</span>
          <h2>项目里程碑</h2>
        </div>
        {!showMilestoneCreateForm && (
          <button
            type="button"
            onClick={() => {
              closeMilestoneEditForm();
              openMilestoneCreateForm();
            }}
            className="btn btn-secondary"
          >
            <Icon name="plus" size={14} />
            新增项目里程碑
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setSelectedPlanType("all")}
          className={`btn ${selectedPlanType === "all" ? "btn-primary" : "btn-secondary"}`}
        >
          全部
        </button>
        {PROJECT_PLAN_TYPES.map((planType) => (
          <button
            key={planType.value}
            type="button"
            onClick={() => setSelectedPlanType(planType.value)}
            className={`btn ${selectedPlanType === planType.value ? "btn-primary" : "btn-secondary"}`}
          >
            {PROJECT_PLAN_TYPE_LABELS[planType.value] || planType.label}
          </button>
        ))}
      </div>

      {showMilestoneCreateForm && (
        <form onSubmit={handleMilestoneCreateSubmit} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  名称 *
                </label>
                <input
                  type="text"
                  value={milestoneCreateForm.title}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="例如：需求冻结 / 提测 / 发布"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  状态
                </label>
                <select
                  value={milestoneCreateForm.status}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {PROJECT_MILESTONE_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  计划类型
                </label>
                <select
                  value={milestoneCreateForm.planType}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, planType: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {PROJECT_PLAN_TYPES.map((planType) => (
                    <option key={planType.value} value={planType.value}>
                      {planType.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  目标日期
                </label>
                <input
                  type="date"
                  value={milestoneCreateForm.targetDate}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  实际日期
                </label>
                <input
                  type="date"
                  value={milestoneCreateForm.actualDate}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, actualDate: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  负责人
                </label>
                <input
                  type="text"
                  value={milestoneCreateForm.owner}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, owner: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  排序
                </label>
                <input
                  type="number"
                  value={milestoneCreateForm.sortOrder}
                  onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                关联链接
              </label>
              <input
                type="url"
                value={milestoneCreateForm.sourceUrl}
                onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                说明
              </label>
              <textarea
                value={milestoneCreateForm.description}
                onChange={(e) => setMilestoneCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
              />
            </div>

            {milestoneCreateError && (
              <p style={{ margin: 0, color: "var(--accent-red)", fontSize: 13 }}>{milestoneCreateError}</p>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="button" onClick={closeMilestoneCreateForm} className="btn btn-secondary" disabled={milestoneCreateSaving}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={milestoneCreateSaving}>
                {milestoneCreateSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      )}

      {milestoneActionError && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--accent-red)" }}>{milestoneActionError}</p>
        </div>
      )}

      {milestonesLoading ? (
        <div className="card empty-state">
          <p>加载中...</p>
        </div>
      ) : milestonesError ? (
        <div className="card empty-state">
          <p>项目里程碑加载失败</p>
        </div>
      ) : milestones.length === 0 ? (
        <div className="card empty-state">
          <p>建议补充下一里程碑</p>
        </div>
      ) : filteredMilestones.length === 0 ? (
        <div className="card empty-state">
          <p>当前筛选条件下暂无项目里程碑</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredMilestones.map((milestone) => {
            const isEditingMilestone = editingMilestoneId === milestone.id;
            const isDeletingMilestone = deletingMilestoneId === milestone.id;

            if (isEditingMilestone) {
              return (
                <form key={milestone.id} onSubmit={(e) => handleMilestoneEditSubmit(e, milestone.id)} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          名称 *
                        </label>
                        <input
                          type="text"
                          value={milestoneEditForm.title}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, title: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          状态
                        </label>
                        <select
                          value={milestoneEditForm.status}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, status: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        >
                          {PROJECT_MILESTONE_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          计划类型
                        </label>
                        <select
                          value={milestoneEditForm.planType}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, planType: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        >
                          {PROJECT_PLAN_TYPES.map((planType) => (
                            <option key={planType.value} value={planType.value}>
                              {planType.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          目标日期
                        </label>
                        <input
                          type="date"
                          value={milestoneEditForm.targetDate}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          实际日期
                        </label>
                        <input
                          type="date"
                          value={milestoneEditForm.actualDate}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, actualDate: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          负责人
                        </label>
                        <input
                          type="text"
                          value={milestoneEditForm.owner}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, owner: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          排序
                        </label>
                        <input
                          type="number"
                          value={milestoneEditForm.sortOrder}
                          onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        关联链接
                      </label>
                      <input
                        type="url"
                        value={milestoneEditForm.sourceUrl}
                        onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        说明
                      </label>
                      <textarea
                        value={milestoneEditForm.description}
                        onChange={(e) => setMilestoneEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                      />
                    </div>

                    {milestoneEditError && (
                      <p style={{ margin: 0, color: "var(--accent-red)", fontSize: 13 }}>
                        {milestoneEditError}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={closeMilestoneEditForm}
                        className="btn btn-secondary"
                        disabled={milestoneEditSaving}
                      >
                        取消
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={milestoneEditSaving}>
                        {milestoneEditSaving ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                </form>
              );
            }

            return (
              <div key={milestone.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{milestone.title}</strong>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                        {PROJECT_MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}
                      </span>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                        {PROJECT_PLAN_TYPE_LABELS[milestone.planType || "milestone"] || PROJECT_PLAN_TYPE_LABELS.milestone}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                      <span>目标日期：{milestone.targetDate ? formatDate(milestone.targetDate) : "-"}</span>
                      <span>实际日期：{milestone.actualDate ? formatDate(milestone.actualDate) : "-"}</span>
                      <span>负责人：{milestone.owner || "-"}</span>
                    </div>

                    {milestone.description && (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {milestone.description}
                      </p>
                    )}
                  </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => openMilestoneEditForm(milestone)}
                      className="btn btn-secondary"
                      disabled={isDeletingMilestone}
                    >
                      <Icon name="edit" size={14} />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMilestoneDelete(milestone.id)}
                      className="btn btn-secondary"
                      disabled={isDeletingMilestone}
                      style={{ color: "var(--accent-red)" }}
                    >
                      <Icon name="trash-2" size={14} />
                      {isDeletingMilestone ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>

                {milestone.sourceUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <a
                      href={milestone.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent-blue)", textDecoration: "underline", fontSize: 14 }}
                    >
                      打开关联链接
                    </a>
                      <div
                        style={{
                          minWidth: 0,
                          fontSize: 13,
                          color: "var(--text-secondary)",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {milestone.sourceUrl}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>关联链接：-</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
