"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ToolLink {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function ToolLinkRow({
  tool,
  onEdit,
  onDelete,
  onToggleEnabled,
  onSaveSortOrder,
}: {
  tool: ToolLink;
  onEdit: (tool: ToolLink) => void;
  onDelete: (tool: ToolLink) => void;
  onToggleEnabled: (tool: ToolLink) => Promise<void>;
  onSaveSortOrder: (tool: ToolLink, sortOrder: number) => Promise<void>;
}) {
  const [sortOrder, setSortOrder] = useState(String(tool.sortOrder));

  useEffect(() => {
    setSortOrder(String(tool.sortOrder));
  }, [tool.sortOrder]);

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{tool.name}</h3>
            <span
              className="badge"
              style={{
                fontSize: 10,
                background: tool.enabled ? "var(--accent-green)" : "var(--bg-tertiary)",
                color: tool.enabled ? "white" : "var(--text-secondary)",
              }}
            >
              {tool.enabled ? "已启用" : "已停用"}
            </span>
          </div>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent-blue)", fontSize: 13, wordBreak: "break-all", textDecoration: "none" }}
          >
            {tool.url}
          </a>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>排序 {tool.sortOrder}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onEdit(tool)}>
          编辑
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onToggleEnabled(tool)}>
          {tool.enabled ? "停用" : "启用"}
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onDelete(tool)}>
          删除
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
          <span>sortOrder</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              width: 100,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
            }}
          />
        </label>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => onSaveSortOrder(tool, Number(sortOrder) || 0)}>
          保存排序
        </button>
      </div>
    </div>
  );
}

export default function ToolSettingsPage() {
  const [toolLinks, setToolLinks] = useState<ToolLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    url: "",
    enabled: true,
    sortOrder: "0",
  });

  const fetchToolLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tool-links", { cache: "no-store" });
      const data = await res.json();
      setToolLinks(data.toolLinks || []);
    } catch (error) {
      console.error("Error fetching tool links:", error);
      setToolLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolLinks();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      url: "",
      enabled: true,
      sortOrder: "0",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      alert("名称和链接不能为空");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        enabled: form.enabled,
        sortOrder: Number(form.sortOrder) || 0,
      };

      const res = await fetch(editingId ? `/api/tool-links/${editingId}` : "/api/tool-links", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "保存失败");
        return;
      }

      await fetchToolLinks();
      resetForm();
    } catch (error) {
      console.error("Error saving tool link:", error);
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tool: ToolLink) => {
    setEditingId(tool.id);
    setForm({
      name: tool.name,
      url: tool.url,
      enabled: tool.enabled,
      sortOrder: String(tool.sortOrder),
    });
  };

  const handleDelete = async (tool: ToolLink) => {
    if (!confirm(`确定删除常用工具「${tool.name}」吗？`)) return;

    try {
      const res = await fetch(`/api/tool-links/${tool.id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "删除失败");
        return;
      }
      await fetchToolLinks();
      if (editingId === tool.id) {
        resetForm();
      }
    } catch (error) {
      console.error("Error deleting tool link:", error);
      alert("删除失败");
    }
  };

  const handleToggleEnabled = async (tool: ToolLink) => {
    try {
      const res = await fetch(`/api/tool-links/${tool.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !tool.enabled }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "更新失败");
        return;
      }

      await fetchToolLinks();
    } catch (error) {
      console.error("Error toggling tool link:", error);
      alert("更新失败");
    }
  };

  const handleSaveSortOrder = async (tool: ToolLink, sortOrder: number) => {
    try {
      const res = await fetch(`/api/tool-links/${tool.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "保存排序失败");
        return;
      }

      await fetchToolLinks();
    } catch (error) {
      console.error("Error saving sort order:", error);
      alert("保存排序失败");
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>常用工具设置</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            这里维护右上角常用工具菜单。只负责跳转，不做登录、OAuth、API 集成或状态同步。
          </p>
        </div>
        <Link href="/" className="btn btn-secondary" style={{ fontSize: 13 }}>
          返回 Dashboard
        </Link>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
          {editingId ? "编辑工具" : "新增工具"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                名称 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如 JIRA"
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
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                链接 *
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
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
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "160px 160px 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                启用
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)", paddingTop: 10 }}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                启用菜单项
              </label>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                sortOrder
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
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
            <div style={{ display: "flex", alignItems: "end", gap: 8, justifyContent: "flex-end" }}>
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ fontSize: 13 }}>
                  取消编辑
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 13 }}>
                {saving ? "保存中..." : editingId ? "更新工具" : "新增工具"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>工具列表</h2>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{toolLinks.length} 项</span>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
            加载中...
          </div>
        ) : toolLinks.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">🔧</div>
            暂无常用工具，请先添加 JIRA、Gerrit、Jenkins 等链接。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {toolLinks.map((tool) => (
              <ToolLinkRow
                key={tool.id}
                tool={tool}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleEnabled={handleToggleEnabled}
                onSaveSortOrder={handleSaveSortOrder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
