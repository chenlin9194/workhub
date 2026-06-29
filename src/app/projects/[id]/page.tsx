"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import {
  PROJECT_LINK_CATEGORIES,
  PROJECT_STATUS_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_TYPE_LABELS,
  HEALTH_LABELS,
} from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";
import type { Project, ProjectLink } from "@/lib/types";

const HEALTH_TONE: Record<string, string> = {
  green: "success",
  yellow: "warning",
  red: "danger",
  unknown: "neutral",
};

type LinkFormState = {
  title: string;
  url: string;
  category: string;
  description: string;
  isPrimary: boolean;
  sortOrder: string;
};

const EMPTY_LINK_FORM: LinkFormState = {
  title: "",
  url: "",
  category: "",
  description: "",
  isPrimary: false,
  sortOrder: "0",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState(false);
  const [linkActionError, setLinkActionError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<LinkFormState>(EMPTY_LINK_FORM);

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<LinkFormState>(EMPTY_LINK_FORM);

  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const projectLinkCategoryLabels: Record<string, string> = Object.fromEntries(
    PROJECT_LINK_CATEGORIES.map((category) => [category.value, category.label])
  );

  const validateLinkForm = useCallback((form: LinkFormState) => {
    const title = form.title.trim();
    const url = form.url.trim();
    const category = form.category.trim();

    if (!title || !url || !category) {
      return "标题、链接地址和分类不能为空";
    }

    return "";
  }, []);

  const buildLinkPayload = useCallback((form: LinkFormState) => {
    const sortOrderValue = Number(form.sortOrder);

    return {
      title: form.title.trim(),
      url: form.url.trim(),
      category: form.category.trim(),
      description: form.description,
      isPrimary: form.isPrimary,
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
    };
  }, []);

  const resetCreateForm = useCallback(() => {
    setCreateForm(EMPTY_LINK_FORM);
    setCreateError("");
  }, []);

  const resetEditForm = useCallback(() => {
    setEditForm(EMPTY_LINK_FORM);
    setEditError("");
  }, []);

  const fetchLinks = useCallback(async () => {
    try {
      setLinksLoading(true);
      setLinksError(false);

      const res = await fetch(`/api/projects/${id}/links`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      } else {
        setLinks([]);
        setLinksError(true);
      }
    } catch (error) {
      console.error("Error fetching project links:", error);
      setLinks([]);
      setLinksError(true);
    } finally {
      setLinksLoading(false);
    }
  }, [id]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchLinks();
  }, [fetchLinks, fetchProject]);

  const openCreateForm = () => {
    resetEditForm();
    setEditingLinkId(null);
    setLinkActionError("");
    resetCreateForm();
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    resetCreateForm();
    setShowCreateForm(false);
  };

  const openEditForm = (link: ProjectLink) => {
    closeCreateForm();
    setLinkActionError("");
    setEditingLinkId(link.id);
    setEditError("");
    setEditForm({
      title: link.title,
      url: link.url,
      category: link.category,
      description: link.description || "",
      isPrimary: link.isPrimary,
      sortOrder: String(link.sortOrder),
    });
  };

  const closeEditForm = () => {
    resetEditForm();
    setEditingLinkId(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createSaving) return;

    const validationError = validateLinkForm(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreateSaving(true);
    setCreateError("");
    setLinkActionError("");

    try {
      const res = await fetch(`/api/projects/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildLinkPayload(createForm)),
      });

      if (!res.ok) {
        setCreateError("保存关键链接失败");
        return;
      }

      closeCreateForm();
      await fetchLinks();
    } catch (error) {
      console.error("Error creating project link:", error);
      setCreateError("保存关键链接失败");
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent, linkId: string) => {
    e.preventDefault();
    if (editSaving) return;

    const validationError = validateLinkForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSaving(true);
    setEditError("");
    setLinkActionError("");

    try {
      const res = await fetch(`/api/projects/${id}/links/${linkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildLinkPayload(editForm)),
      });

      if (!res.ok) {
        setEditError("更新关键链接失败");
        return;
      }

      closeEditForm();
      await fetchLinks();
    } catch (error) {
      console.error("Error updating project link:", error);
      setEditError("更新关键链接失败");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    if (deletingLinkId) return;
    if (!confirm("确认删除这个关键链接吗？")) return;

    setDeletingLinkId(linkId);
    setLinkActionError("");

    try {
      const res = await fetch(`/api/projects/${id}/links/${linkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setLinkActionError("删除关键链接失败");
        return;
      }

      if (editingLinkId === linkId) {
        closeEditForm();
      }

      await fetchLinks();
    } catch (error) {
      console.error("Error deleting project link:", error);
      setLinkActionError("删除关键链接失败");
    } finally {
      setDeletingLinkId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card empty-state"><p>加载中...</p></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-shell">
        <div className="card empty-state">
          <div className="empty-icon"><Icon name="folder" size={28} /></div>
          <p>项目不存在</p>
          <Link href="/projects" className="btn btn-secondary">返回项目列表</Link>
        </div>
      </div>
    );
  }

  const items = project.items || [];
  const logs = project.logs || [];
  const p0p1Count = items.filter((i) => (i.priority === "P0" || i.priority === "P1") && i.status !== "closed").length;
  const blockedCount = items.filter((i) => i.status === "blocked").length;
  const redYellowCount = items.filter((i) => i.health === "red" || i.health === "yellow").length;
  const today = getLocalDateString();
  const overdueCount = items.filter((i) => i.dueDate && i.dueDate < today && i.status !== "closed").length;

  return (
    <div className="page-shell">
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Link href="/projects" style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                <Icon name="arrow-left" size={14} /> 返回列表
              </Link>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              {project.name}
              {project.code && <span style={{ fontSize: 14, color: "var(--text-tertiary)", marginLeft: 12 }}>{project.code}</span>}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <span className={`badge badge-${HEALTH_TONE[project.health] || "neutral"}`}>
                {HEALTH_LABELS[project.health] || project.health}
              </span>
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                {PROJECT_STATUS_LABELS[project.status] || project.status}
              </span>
              {project.stage && (
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  {PROJECT_STAGE_LABELS[project.stage] || project.stage}
                </span>
              )}
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                {PROJECT_TYPE_LABELS[project.type] || project.type}
              </span>
            </div>
          </div>
          <Link href={`/projects/${project.id}/edit`} className="btn btn-secondary">
            <Icon name="edit" size={15} />
            编辑项目
          </Link>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {project.owner && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>负责人</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.owner}</div>
              </div>
            )}
            {project.pm && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>PM</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.pm}</div>
              </div>
            )}
            {project.startDate && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>开始日期</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{new Date(project.startDate).toLocaleDateString()}</div>
              </div>
            )}
            {project.targetDate && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>目标日期</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{new Date(project.targetDate).toLocaleDateString()}</div>
              </div>
            )}
            {project.releaseDate && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>发布日期</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{new Date(project.releaseDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          {project.currentSummary && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>当前摘要</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{project.currentSummary}</div>
            </div>
          )}

          {(project.nextMilestone || project.nextAction) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-primary)", display: "flex", gap: 24, flexWrap: "wrap" }}>
              {project.nextMilestone && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下个里程碑</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.nextMilestone}</div>
                </div>
              )}
              {project.nextAction && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一步行动</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.nextAction}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{project._count?.items || 0}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>关联事项</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{project._count?.logs || 0}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>关联日志</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--critical, #ef4444)" }}>{p0p1Count}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>P0/P1</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger, #f97316)" }}>{blockedCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>阻塞</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--warning, #eab308)" }}>{redYellowCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>红/黄</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger, #f97316)" }}>{overdueCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>逾期</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href={`/items/new?projectId=${project.id}`} className="btn btn-primary">
            <Icon name="plus" size={15} />
            新建关联事项
          </Link>
          <Link href={`/logs/new?projectId=${project.id}`} className="btn btn-secondary">
            <Icon name="edit" size={15} />
            新建关联日志
          </Link>
          <a href={`/api/projects/${project.id}/snapshot`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <Icon name="external-link" size={15} />
            项目快照
          </a>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">LINKS</span>
            <h2>关键链接</h2>
          </div>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => {
                closeEditForm();
                openCreateForm();
              }}
              className="btn btn-secondary"
            >
              <Icon name="plus" size={14} />
              新增关键链接
            </button>
          )}
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateSubmit} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                    标题 *
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                    分类 *
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                  >
                    <option value="">请选择分类</option>
                    {PROJECT_LINK_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  链接地址 *
                </label>
                <input
                  type="url"
                  value={createForm.url}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, url: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  说明
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, alignItems: "end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                  <input
                    type="checkbox"
                    checked={createForm.isPrimary}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
                  />
                  设为主链接
                </label>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                    排序
                  </label>
                  <input
                    type="number"
                    value={createForm.sortOrder}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                  />
                </div>
              </div>

              {createError && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--accent-red)" }}>
                  {createError}
                </p>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" onClick={closeCreateForm} className="btn btn-secondary" disabled={createSaving}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={createSaving}>
                  {createSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </form>
        )}

        {linkActionError && (
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--accent-red)" }}>{linkActionError}</p>
          </div>
        )}

        {linksLoading ? (
          <div className="card empty-state">
            <p>加载中...</p>
          </div>
        ) : linksError ? (
          <div className="card empty-state">
            <p>关键链接加载失败</p>
          </div>
        ) : links.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关键链接</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {links.map((link) => {
              const isEditing = editingLinkId === link.id;
              const isDeleting = deletingLinkId === link.id;

              if (isEditing) {
                return (
                  <form key={link.id} onSubmit={(e) => handleEditSubmit(e, link.id)} className="card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                            标题 *
                          </label>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                            分类 *
                          </label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                          >
                            <option value="">请选择分类</option>
                            {PROJECT_LINK_CATEGORIES.map((category) => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          链接地址 *
                        </label>
                        <input
                          type="url"
                          value={editForm.url}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                          说明
                        </label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                          rows={3}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, alignItems: "end" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                          <input
                            type="checkbox"
                            checked={editForm.isPrimary}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
                          />
                          设为主链接
                        </label>
                        <div>
                          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                            排序
                          </label>
                          <input
                            type="number"
                            value={editForm.sortOrder}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                          />
                        </div>
                      </div>

                      {editError && (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--accent-red)" }}>
                          {editError}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button type="button" onClick={closeEditForm} className="btn btn-secondary" disabled={editSaving}>
                          取消
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={editSaving}>
                          {editSaving ? "保存中..." : "保存"}
                        </button>
                      </div>
                    </div>
                  </form>
                );
              }

              return (
                <div key={link.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{link.title}</strong>
                        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                          {projectLinkCategoryLabels[link.category] || link.category}
                        </span>
                        {link.isPrimary && (
                          <span className="badge badge-success">主链接</span>
                        )}
                      </div>
                      {link.description && (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          {link.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => openEditForm(link)}
                        className="btn btn-secondary"
                        disabled={isDeleting}
                      >
                        <Icon name="edit" size={14} />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(link.id)}
                        className="btn btn-secondary"
                        disabled={isDeleting}
                        style={{ color: "var(--accent-red)" }}
                      >
                        <Icon name="trash-2" size={14} />
                        {isDeleting ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--accent-blue)",
                      textDecoration: "underline",
                      fontSize: 13,
                      lineHeight: 1.6,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {link.url}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">ITEMS</span>
            <h2>关联事项</h2>
          </div>
          <Link href="/items" className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关联事项</p>
          </div>
        ) : (
          <div className="content-card-grid">
            {items.slice(0, 20).map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">LOGS</span>
            <h2>最近日志</h2>
          </div>
          <Link href="/logs" className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        {logs.length === 0 ? (
          <div className="card empty-state">
            <p>暂无关联日志</p>
          </div>
        ) : (
          <div className="content-card-grid">
            {logs.slice(0, 20).map((log) => (
              <WorkLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
