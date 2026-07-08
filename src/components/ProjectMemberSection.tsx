"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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

const INPUT_STYLE = {
  width: "100%",
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
};

type ProjectMemberSectionProps = {
  projectId: string;
};

function getMemberSearchText(member: ProjectMember) {
  return [member.name, member.role, member.team, member.responsibility, member.contact]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortMembers(members: ProjectMember[]) {
  return [...members].sort((a, b) => {
    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;

    const sortOrderDiff = a.sortOrder - b.sortOrder;
    if (sortOrderDiff !== 0) return sortOrderDiff;

    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function splitMemberDisplayName(name: string) {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.*?)(\d{5,})$/);
  if (!match) return { displayName: trimmed, displayId: "" };

  const displayName = match[1]?.trim();
  const displayId = match[2]?.trim();
  if (!displayName || !displayId) return { displayName: trimmed, displayId: "" };

  return { displayName, displayId };
}

function inferMemberGroup(member: ProjectMember) {
  const source = [member.name, member.role, member.team, member.responsibility]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!member.role?.trim() || /(tbd|todo|待定|待确认|未知|unknown)/.test(source)) return "待确认成员";
  return "其他成员";
}

function groupMembersByRole(members: ProjectMember[]) {
  const groups = new Map<string, ProjectMember[]>();

  members.forEach((member) => {
    const key = inferMemberGroup(member);
    groups.set(key, [...(groups.get(key) || []), member]);
  });

  const order = ["其他成员", "待确认成员"];
  return order
    .map((label) => ({ label, members: groups.get(label) || [] }))
    .filter((group) => group.members.length > 0);
}

function MemberInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={INPUT_STYLE}
    />
  );
}

function MemberFormPanel({
  title,
  form,
  setForm,
  saving,
  error,
  onSave,
  onCancel,
}: {
  title: string;
  form: MemberFormState;
  setForm: Dispatch<SetStateAction<MemberFormState>>;
  saving: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card entity-card entity-card--compact" style={{ padding: 12, marginBottom: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{title}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onSave} className="btn btn-primary" disabled={saving} style={{ height: 34, padding: "0 12px" }}>
            {saving ? "保存中" : "保存"}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving} style={{ height: 34, padding: "0 12px" }}>
            取消
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>姓名</span>
          <MemberInput value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="姓名 *" />
          {error && <span style={{ color: "var(--accent-red)", fontSize: 12 }}>{error}</span>}
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>角色</span>
          <MemberInput value={form.role} onChange={(value) => setForm((prev) => ({ ...prev, role: value }))} placeholder="SE / 产品 / 测试" />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>团队/领域</span>
          <MemberInput value={form.team} onChange={(value) => setForm((prev) => ({ ...prev, team: value }))} placeholder="领域 / 团队" />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>联系方式</span>
          <MemberInput value={form.contact} onChange={(value) => setForm((prev) => ({ ...prev, contact: value }))} placeholder="联系方式" />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>职责</span>
          <MemberInput value={form.responsibility} onChange={(value) => setForm((prev) => ({ ...prev, responsibility: value }))} placeholder="职责边界" />
        </label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>排序</span>
          <MemberInput type="number" value={form.sortOrder} onChange={(value) => setForm((prev) => ({ ...prev, sortOrder: value }))} placeholder="排序" />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, height: 34 }}>
          <input type="checkbox" checked={form.isCore} onChange={(e) => setForm((prev) => ({ ...prev, isCore: e.target.checked }))} />
          核心
        </label>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  selected,
  onSelect,
}: {
  member: ProjectMember;
  selected: boolean;
  onSelect: (member: ProjectMember) => void;
}) {
  const { displayName, displayId } = splitMemberDisplayName(member.name);

  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      style={{
        border: `1px solid ${selected ? "var(--accent-blue)" : "var(--border-secondary)"}`,
        borderRadius: 8,
        background: selected ? "color-mix(in srgb, var(--accent-blue-light) 42%, var(--bg-primary))" : "var(--bg-primary)",
        padding: "7px 9px",
        textAlign: "left",
        cursor: "pointer",
        color: "var(--text-primary)",
        display: "grid",
        gap: 3,
        minWidth: 0,
      }}
      title={[member.responsibility, member.contact].filter(Boolean).join("\n")}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>{displayName}</strong>
        {displayId && <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, flex: "0 0 auto" }}>ID {displayId}</span>}
        {member.isCore && <span className="entity-pill entity-pill--success" style={{ padding: "1px 6px", fontSize: 11 }}>核心</span>}
      </span>
      <span style={{ color: "var(--text-secondary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {member.role || "角色待补"}
      </span>
    </button>
  );
}

function MemberDetailPanel({
  member,
  deleting,
  onEdit,
  onDelete,
  onClose,
}: {
  member: ProjectMember;
  deleting: boolean;
  onEdit: (member: ProjectMember) => void;
  onDelete: (memberId: string) => void;
  onClose: () => void;
}) {
  const { displayName, displayId } = splitMemberDisplayName(member.name);
  return (
    <div className="card entity-card entity-card--compact" style={{ padding: 12, marginTop: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ color: "var(--text-primary)", fontSize: 15 }}>{displayName}</strong>
            {displayId && <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>ID {displayId}</span>}
            {member.isCore && <span className="entity-pill entity-pill--success">核心</span>}
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
            {member.role || "角色待补"} · {member.team || "团队待补"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(member)} style={{ height: 32, padding: "0 10px" }}>
            <Icon name="edit" size={13} />
            编辑
          </button>
          <button type="button" className="btn btn-danger" disabled={deleting} onClick={() => onDelete(member.id)} style={{ height: 32, padding: "0 10px" }}>
            <Icon name="trash" size={13} />
            {deleting ? "删除中" : "删除"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ height: 32, padding: "0 10px" }}>
            关闭
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <div><span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>职责</span><div style={{ color: "var(--text-secondary)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.responsibility || "—"}</div></div>
        <div><span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>联系方式</span><div style={{ color: member.contact ? "var(--text-secondary)" : "var(--text-tertiary)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.contact || "—"}</div></div>
      </div>
    </div>
  );
}

export default function ProjectMemberSection({ projectId }: ProjectMemberSectionProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");
  const [keyword, setKeyword] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const validateMemberForm = useCallback((form: MemberFormState) => {
    if (!form.name.trim()) return "成员姓名不能为空";
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

      const res = await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch project members: ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Project members response must be an array");

      setMembers(data);
    } catch (error) {
      console.error("Error fetching project members:", error);
      setMembersError(true);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  const refreshMembersAfterSave = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" });
      if (!res.ok) return false;

      const data = await res.json();
      if (!Array.isArray(data)) return false;

      setMembers(data);
      setMembersError(false);
      return true;
    } catch (error) {
      console.error("Error refreshing project members after save:", error);
      return false;
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const openCreateForm = () => {
    resetEditForm();
    setEditingMemberId(null);
    setSelectedMemberId(null);
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

  const handleCreateSubmit = async () => {
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

      const createdMember = await res.json();
      setMembers((prev) => sortMembers([createdMember, ...prev]));
      setMembersError(false);
      closeCreateForm();
      setSelectedMemberId(createdMember.id);
      await refreshMembersAfterSave();
    } catch (error) {
      console.error("Error creating project member:", error);
      setCreateError("保存项目成员失败");
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditSubmit = async (memberId: string) => {
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

      const updatedMember = await res.json();
      setMembers((prev) => sortMembers(prev.map((member) => (member.id === memberId ? updatedMember : member))));
      setMembersError(false);
      closeEditForm();
      setSelectedMemberId(updatedMember.id);
      await refreshMembersAfterSave();
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

      setMembers((prev) => prev.filter((member) => member.id !== memberId));
      if (editingMemberId === memberId) closeEditForm();
      if (selectedMemberId === memberId) setSelectedMemberId(null);
      await refreshMembersAfterSave();
    } catch (error) {
      console.error("Error deleting project member:", error);
      setMemberActionError("删除项目成员失败");
    } finally {
      setDeletingMemberId(null);
    }
  };

  const sortedMembers = useMemo(() => sortMembers(members), [members]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const displayedMembers = useMemo(() => {
    if (!normalizedKeyword) return sortedMembers;
    return sortedMembers.filter((member) => getMemberSearchText(member).includes(normalizedKeyword));
  }, [normalizedKeyword, sortedMembers]);

  const displayedCoreMembers = displayedMembers.filter((member) => member.isCore);
  const displayedOtherMembers = displayedMembers.filter((member) => !member.isCore);
  const groupedOtherMembers = useMemo(() => groupMembersByRole(displayedOtherMembers), [displayedOtherMembers]);
  const selectedMember = selectedMemberId ? members.find((member) => member.id === selectedMemberId) ?? null : null;

  return (
    <section className="cockpit-section">
      <div className="dashboard-section-title" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto" }}>
          <span className="section-eyebrow">MEMBERS</span>
          <h2>项目成员</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", minWidth: 0, flex: "1 1 420px" }}>
          <div style={{ width: 360, maxWidth: "100%", minWidth: 260, position: "relative", flex: "0 1 420px" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-tertiary)", display: "inline-flex" }}>
              <Icon name="search" size={14} />
            </span>
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="查询姓名、角色、团队、职责、联系方式"
              style={{ ...INPUT_STYLE, paddingLeft: 30, height: 36 }}
            />
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
              新增成员
            </button>
          )}
        </div>
      </div>

      {memberActionError && (
        <div className="feedback-note feedback-note--error" style={{ marginBottom: 12 }}>
          {memberActionError}
        </div>
      )}

      {showCreateForm && (
        <MemberFormPanel
          title="新增成员"
          form={createForm}
          setForm={setCreateForm}
          saving={createSaving}
          error={createError}
          onSave={() => void handleCreateSubmit()}
          onCancel={closeCreateForm}
        />
      )}

      {editingMemberId && (
        <MemberFormPanel
          title="编辑成员"
          form={editForm}
          setForm={setEditForm}
          saving={editSaving}
          error={editError}
          onSave={() => void handleEditSubmit(editingMemberId)}
          onCancel={closeEditForm}
        />
      )}

      {membersLoading ? (
        <div className="card empty-state empty-state--loading">
          <div className="empty-icon">…</div>
          <strong>正在读取项目成员</strong>
          <p>成员信息会用于快速判断协作关系和责任边界。</p>
        </div>
      ) : membersError && members.length === 0 ? (
        <div className="card empty-state empty-state--error">
          <div className="empty-icon">!</div>
          <strong>项目成员暂时加载失败</strong>
          <p>可以稍后重试，不影响项目其它信息查看。</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void fetchMembers()}>
              重试
            </button>
          </div>
        </div>
      ) : members.length === 0 && !showCreateForm ? (
        <div className="card empty-state">
          <div className="empty-icon">👥</div>
          <strong>还没有项目成员</strong>
          <p>可补充 SE、产品、项目、测试、开发等关键角色。</p>
        </div>
      ) : (
        <div className="card entity-card entity-card--compact" style={{ padding: 12, display: "grid", gap: 12 }}>
          {displayedMembers.length === 0 && !showCreateForm ? (
            <div style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
              当前查询条件下没有成员
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong style={{ color: "var(--text-primary)", fontSize: 13 }}>核心成员</strong>
                </div>
                {displayedCoreMembers.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
                    {displayedCoreMembers.map((member) => (
                      <MemberCard key={member.id} member={member} selected={selectedMemberId === member.id} onSelect={(nextMember) => setSelectedMemberId(nextMember.id)} />
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13, padding: "6px 0" }}>暂无核心成员</div>
                )}
              </div>

                {displayedOtherMembers.length > 0 && (
                  <div style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border-secondary)" }}>
                    {groupedOtherMembers.map((group) => (
                      <div key={group.label} style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <strong style={{ color: "var(--text-secondary)", fontSize: 13 }}>{group.label}</strong>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
                          {group.members.map((member) => (
                            <MemberCard key={member.id} member={member} selected={selectedMemberId === member.id} onSelect={(nextMember) => setSelectedMemberId(nextMember.id)} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {selectedMember && !editingMemberId && (
        <MemberDetailPanel
          member={selectedMember}
          deleting={deletingMemberId === selectedMember.id}
          onEdit={openEditForm}
          onDelete={handleDelete}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </section>
  );
}
