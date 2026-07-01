"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import type { ProjectMember } from "@/lib/types";

type MemberFormState = {
  name: string;
  role: string;
  team: string;
  responsibility: string;
  contact: string;
  isCore: boolean;
  sortOrder: string;
};

const EMPTY_MEMBER_FORM: MemberFormState = {
  name: "",
  role: "",
  team: "",
  responsibility: "",
  contact: "",
  isCore: false,
  sortOrder: "0",
};

type ProjectMemberSectionProps = {
  projectId: string;
};

export default function ProjectMemberSection({ projectId }: ProjectMemberSectionProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const validateMemberForm = useCallback((form: MemberFormState) => {
    if (!form.name.trim()) {
      return "成员姓名不能为空";
    }

    return "";
  }, []);

  const buildMemberPayload = useCallback((form: MemberFormState) => {
    const sortOrderValue = Number(form.sortOrder);

    return {
      name: form.name.trim(),
      role: form.role,
      team: form.team,
      responsibility: form.responsibility,
      contact: form.contact,
      isCore: form.isCore,
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
    };
  }, []);

  const resetCreateForm = useCallback(() => {
    setCreateForm(EMPTY_MEMBER_FORM);
    setCreateError("");
  }, []);

  const resetEditForm = useCallback(() => {
    setEditForm(EMPTY_MEMBER_FORM);
    setEditError("");
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      setMembersError(false);

      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      } else {
        setMembers([]);
        setMembersError(true);
      }
    } catch (error) {
      console.error("Error fetching project members:", error);
      setMembers([]);
      setMembersError(true);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const openCreateForm = () => {
    resetEditForm();
    setEditingMemberId(null);
    setMemberActionError("");
    resetCreateForm();
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    resetCreateForm();
    setShowCreateForm(false);
  };

  const openEditForm = (member: ProjectMember) => {
    closeCreateForm();
    setMemberActionError("");
    setEditingMemberId(member.id);
    setEditError("");
    setEditForm({
      name: member.name,
      role: member.role || "",
      team: member.team || "",
      responsibility: member.responsibility || "",
      contact: member.contact || "",
      isCore: member.isCore,
      sortOrder: String(member.sortOrder),
    });
  };

  const closeEditForm = () => {
    resetEditForm();
    setEditingMemberId(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createSaving) return;

    const validationError = validateMemberForm(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreateSaving(true);
    setCreateError("");
    setMemberActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMemberPayload(createForm)),
      });

      if (!res.ok) {
        setCreateError("保存项目成员失败");
        return;
      }

      closeCreateForm();
      await fetchMembers();
    } catch (error) {
      console.error("Error creating project member:", error);
      setCreateError("保存项目成员失败");
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent, memberId: string) => {
    e.preventDefault();
    if (editSaving) return;

    const validationError = validateMemberForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSaving(true);
    setEditError("");
    setMemberActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMemberPayload(editForm)),
      });

      if (!res.ok) {
        setEditError("更新项目成员失败");
        return;
      }

      closeEditForm();
      await fetchMembers();
    } catch (error) {
      console.error("Error updating project member:", error);
      setEditError("更新项目成员失败");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (deletingMemberId) return;
    if (!confirm("确认删除这个项目成员吗？")) return;

    setDeletingMemberId(memberId);
    setMemberActionError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setMemberActionError("删除项目成员失败");
        return;
      }

      if (editingMemberId === memberId) {
        closeEditForm();
      }

      await fetchMembers();
    } catch (error) {
      console.error("Error deleting project member:", error);
      setMemberActionError("删除项目成员失败");
    } finally {
      setDeletingMemberId(null);
    }
  };

  const renderMemberForm = (
    form: MemberFormState,
    setForm: React.Dispatch<React.SetStateAction<MemberFormState>>,
    error: string,
    saving: boolean,
    onCancel: () => void
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
            姓名 *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
            角色
          </label>
          <input
            type="text"
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            placeholder="例如：项目经理 / 测试负责人 / 开发负责人"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
            团队
          </label>
          <input
            type="text"
            value={form.team}
            onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
            联系方式
          </label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
            排序
          </label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
          职责
        </label>
        <textarea
          value={form.responsibility}
          onChange={(e) => setForm((prev) => ({ ...prev, responsibility: e.target.value }))}
          rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
        <input
          type="checkbox"
          checked={form.isCore}
          onChange={(e) => setForm((prev) => ({ ...prev, isCore: e.target.checked }))}
        />
        核心成员
      </label>

      {error && (
        <p style={{ margin: 0, color: "var(--accent-red)", fontSize: 13 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">MEMBERS</span>
          <h2>项目成员</h2>
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
            新增项目成员
          </button>
        )}
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="card" style={{ padding: 16, marginBottom: 12 }}>
          {renderMemberForm(createForm, setCreateForm, createError, createSaving, closeCreateForm)}
        </form>
      )}

      {memberActionError && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--accent-red)" }}>{memberActionError}</p>
        </div>
      )}

      {membersLoading ? (
        <div className="card empty-state">
          <p>加载中...</p>
        </div>
      ) : membersError ? (
        <div className="card empty-state">
          <p>项目成员加载失败</p>
        </div>
      ) : members.length === 0 ? (
        <div className="card empty-state">
          <p>建议补充核心成员</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {members.map((member) => {
            const isEditing = editingMemberId === member.id;
            const isDeleting = deletingMemberId === member.id;

            if (isEditing) {
              return (
                <form key={member.id} onSubmit={(e) => handleEditSubmit(e, member.id)} className="card" style={{ padding: 16 }}>
                  {renderMemberForm(editForm, setEditForm, editError, editSaving, closeEditForm)}
                </form>
              );
            }

            return (
              <div key={member.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{member.name}</strong>
                      {member.role && (
                        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                          {member.role}
                        </span>
                      )}
                      {member.isCore && <span className="badge badge-success">核心成员</span>}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                      <span>团队：{member.team || "-"}</span>
                      <span>联系方式：{member.contact || "-"}</span>
                    </div>

                    {member.responsibility && (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {member.responsibility}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => openEditForm(member)}
                      className="btn btn-secondary"
                      disabled={isDeleting}
                    >
                      <Icon name="edit" size={14} />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id)}
                      className="btn btn-secondary"
                      disabled={isDeleting}
                      style={{ color: "var(--accent-red)" }}
                    >
                      <Icon name="trash-2" size={14} />
                      {isDeleting ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
