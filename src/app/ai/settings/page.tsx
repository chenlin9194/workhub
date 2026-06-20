"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import type { AiProvider } from "@/lib/types";

const presets = [
  { name: "claude", label: "Claude (Anthropic)", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" },
  { name: "openai", label: "OpenAI / Codex", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { name: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { name: "hermes", label: "Hermes (自定义)", baseUrl: "", model: "" },
  { name: "custom", label: "自定义模型", baseUrl: "", model: "" },
];

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "", label: "", baseUrl: "", apiKey: "", model: "", isDefault: false,
  });

  useEffect(() => { fetchProviders(); }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-providers");
      if (res.ok) setProviders(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const applyPreset = (name: string) => {
    const p = presets.find((x) => x.name === name);
    if (p) setForm((f) => ({ ...f, name: p.name, label: p.label, baseUrl: p.baseUrl, model: p.model }));
  };

  const handleSave = async () => {
    setError(""); setSaving(true);
    try {
      const url = editId ? `/api/ai-providers/${editId}` : "/api/ai-providers";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowForm(false); setEditId(null);
      setForm({ name: "", label: "", baseUrl: "", apiKey: "", model: "", isDefault: false });
      setSuccess(editId ? "更新成功" : "添加成功");
      setTimeout(() => setSuccess(""), 2000);
      fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    await fetch(`/api/ai-providers/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    fetchProviders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模型配置？")) return;
    await fetch(`/api/ai-providers/${id}`, { method: "DELETE" });
    fetchProviders();
  };

  const handleEdit = (p: AiProvider) => {
    setEditId(p.id);
    setForm({ name: p.name, label: p.label, baseUrl: p.baseUrl, apiKey: "", model: p.model, isDefault: p.isDefault });
    setShowForm(true);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>AI 模型配置</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            管理你的 AI 模型，支持所有 OpenAI 兼容 API
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", label: "", baseUrl: "", apiKey: "", model: "", isDefault: false }); }} className="btn btn-primary">
          <Icon name="plus" size={15} /> 添加模型
        </button>
      </div>

      {success && <div className="toast toast-success">{success}</div>}

      {/* Provider List */}
      {loading ? (
        <div className="card empty-state">加载中...</div>
      ) : providers.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🤖</div>
          <div style={{ marginBottom: 12 }}>还没有配置 AI 模型</div>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">添加第一个模型</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {providers.map((p) => (
            <div key={p.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{p.label}</span>
                    {p.isDefault && (
                      <span style={{
                        padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: "var(--accent-green-light)", color: "var(--accent-green)",
                      }}>默认</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>模型: <strong style={{ color: "var(--text-secondary)" }}>{p.model}</strong></span>
                    <span>API Key: {p.apiKey}</span>
                    <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Endpoint: {p.baseUrl}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {!p.isDefault && (
                    <button onClick={() => handleSetDefault(p.id)} className="btn btn-ghost btn-sm" title="设为默认">
                      <Icon name="check-circle" size={14} />
                    </button>
                  )}
                  <button onClick={() => handleEdit(p)} className="btn btn-ghost btn-sm">
                    <Icon name="edit" size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--accent-red)" }}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                {editId ? "编辑模型" : "添加 AI 模型"}
              </h2>
              <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm"><Icon name="x" size={16} /></button>
            </div>

            {error && (
              <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--accent-red-light)", color: "var(--accent-red)", fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Presets */}
            {!editId && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>快速选择</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {presets.map((p) => (
                    <button key={p.name} onClick={() => applyPreset(p.name)} className="btn btn-ghost btn-sm">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>显示名称</label>
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="input" placeholder="如：Claude Sonnet" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>API Base URL</label>
                <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} className="input" placeholder="https://api.openai.com/v1" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
                  API Key {editId && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>(留空保持不变)</span>}
                </label>
                <input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} className="input" placeholder="sk-..." />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>模型名称</label>
                <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="input" placeholder="gpt-4o / claude-sonnet-4-20250514 / deepseek-chat" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                设为默认模型
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} className="btn btn-ghost">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? "保存中..." : editId ? "更新" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
