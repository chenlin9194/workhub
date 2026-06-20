"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOTE_TYPES, PRIORITIES, STATUSES, SOURCES, MODULES } from "@/lib/constants";
import Icon from "./Icon";

interface NoteFormData {
  title: string;
  content: string;
  project: string;
  module: string;
  type: string;
  priority: string;
  status: string;
  owner: string;
  dueDate: string;
  source: string;
  tags: string;
}

interface NoteFormProps {
  initialData?: Partial<NoteFormData>;
  noteId?: string;
  mode: "create" | "edit";
}

const emptyForm: NoteFormData = {
  title: "", content: "", project: "", module: "",
  type: "note", priority: "P2", status: "open",
  owner: "", dueDate: "", source: "manual", tags: "",
};

export default function NoteForm({ initialData, noteId, mode }: NoteFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<NoteFormData>({ ...emptyForm, ...initialData });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) { setError("标题不能为空"); return; }
    if (!form.content.trim()) { setError("内容不能为空"); return; }

    setSaving(true);
    try {
      const url = mode === "edit" ? `/api/notes/${noteId}` : "/api/notes";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }
      const note = await res.json();
      router.push(`/notes/${note.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius-md)",
          background: "var(--accent-red-light)", color: "var(--accent-red)",
          fontSize: 13, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* Required */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="edit" size={16} />
          基本信息
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              标题 <span style={{ color: "var(--accent-red)" }}>*</span>
            </label>
            <input
              type="text" name="title" value={form.title} onChange={handleChange}
              className="input" placeholder="简要描述工作事项..."
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              详细内容 <span style={{ color: "var(--accent-red)" }}>*</span>
            </label>
            <textarea
              name="content" value={form.content} onChange={handleChange}
              rows={6} className="input" placeholder="详细记录背景、进展、结论等..."
            />
          </div>
        </div>
      </div>

      {/* Optional */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="settings" size={16} />
          结构化信息
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>项目/版本</label>
            <input type="text" name="project" value={form.project} onChange={handleChange} className="input" placeholder="如 OS 16.0" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>模块</label>
            <select name="module" value={form.module} onChange={handleChange} className="input">
              <option value="">选择模块</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>类型</label>
            <select name="type" value={form.type} onChange={handleChange} className="input">
              {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>优先级</label>
            <select name="priority" value={form.priority} onChange={handleChange} className="input">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>状态</label>
            <select name="status" value={form.status} onChange={handleChange} className="input">
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>来源</label>
            <select name="source" value={form.source} onChange={handleChange} className="input">
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>责任人</label>
            <input type="text" name="owner" value={form.owner} onChange={handleChange} className="input" placeholder="负责人姓名" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>截止日期</label>
            <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} className="input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>标签</label>
            <input type="text" name="tags" value={form.tags} onChange={handleChange} className="input" placeholder="逗号分隔" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={saving} className="btn btn-primary btn-lg" style={{ opacity: saving ? 0.6 : 1 }}>
          <Icon name="check-circle" size={16} />
          {saving ? "保存中..." : mode === "edit" ? "更新记录" : "保存记录"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-ghost btn-lg">
          取消
        </button>
      </div>
    </form>
  );
}
