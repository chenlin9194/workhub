"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

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
    <div className="card tool-card">
      <div className="tool-card-header">
        <div>
          <div className="tool-card-title-row">
            <h3 className="tool-card-title">{tool.name}</h3>
            <span className={`entity-pill ${tool.enabled ? "entity-pill--success" : "entity-pill--muted"}`}>
              {tool.enabled ? "已启用" : "已停用"}
            </span>
          </div>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tool-card-url"
          >
            {tool.url}
          </a>
        </div>
        <div className="entity-card-note">排序 {tool.sortOrder}</div>
      </div>

      <div className="tool-card-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(tool)}>
          编辑
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onToggleEnabled(tool)}>
          {tool.enabled ? "停用" : "启用"}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(tool)}>
          删除
        </button>
        <label className="tool-sort-control">
          <span>排序值</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="form-field-control tool-sort-input"
          />
        </label>
        <button className="btn btn-primary btn-sm" onClick={() => onSaveSortOrder(tool, Number(sortOrder) || 0)}>
          保存排序
        </button>
      </div>
    </div>
  );
}

export default function ToolSettingsPage() {
  const [toolLinks, setToolLinks] = useState<ToolLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
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
    setLoadingError("");
    try {
      const res = await fetch("/api/tool-links", { cache: "no-store" });
      if (!res.ok) throw new Error("tool links request failed");
      const data = await res.json();
      setToolLinks(data.toolLinks || []);
    } catch (error) {
      console.error("Error fetching tool links:", error);
      setToolLinks([]);
      setLoadingError("常用工具暂时加载失败");
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

  const enabledTools = toolLinks.filter((tool) => tool.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const disabledToolCount = toolLinks.length - enabledTools.length;

  return (
    <div className="page-shell auxiliary-page tool-settings-page tool-console-page">
      <div className="command-page-header tool-settings-header">
        <div>
          <span className="section-eyebrow">TOOLS / SETUP</span>
          <h1>常用工具设置</h1>
          <p>
            这里维护右上角常用工具菜单。只负责跳转，不做登录、OAuth、API 集成或状态同步。
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/" className="btn btn-secondary btn-sm">
            返回工作台
          </Link>
        </div>
      </div>

      <div className="card cockpit-card tool-console-summary">
        <div className="cockpit-card-head">
          <div>
            <span className="section-eyebrow">TOOL CONSOLE</span>
            <h2>工具入口管理台</h2>
          </div>
          <span className="section-count">只维护跳转链接</span>
        </div>
        <div className="tool-console-grid">
          <div className="tool-console-metrics">
            <span className="entity-pill entity-pill--success">启用 {enabledTools.length}</span>
            <span className="entity-pill entity-pill--muted">停用 {disabledToolCount}</span>
            <span className="entity-pill entity-pill--muted">排序越小越靠前</span>
          </div>
          <div className="tool-menu-preview">
            <div className="tool-menu-preview-head">
              <Icon name="settings" size={15} />
              <span>右上角菜单预览</span>
            </div>
            <div className="tool-menu-preview-list">
              {enabledTools.length === 0 ? (
                <span className="tool-menu-preview-empty">启用工具后会出现在这里</span>
              ) : (
                enabledTools.slice(0, 5).map((tool) => (
                  <a key={tool.id} href={tool.url} target="_blank" rel="noopener noreferrer">
                    <span>{tool.name}</span>
                    <small>{tool.sortOrder}</small>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card form-card tool-settings-form-card">
        <div className="form-section-header">
          <h2>{editingId ? "编辑工具" : "新增工具"}</h2>
          <p>只维护常用入口，排序越小越靠前显示。</p>
        </div>
        <form onSubmit={handleSubmit} className="tool-settings-form">
          <div className="tool-settings-primary-grid">
            <div>
              <label className="form-field-label">
                名称 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如 JIRA"
                required
                className="form-field-control"
              />
            </div>
            <div>
              <label className="form-field-label">
                链接 *
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
                required
                className="form-field-control"
              />
            </div>
          </div>

          <div className="tool-settings-meta-grid">
            <div>
              <label className="form-field-label">
                启用
              </label>
              <label className="tool-enabled-control">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                启用菜单项
              </label>
            </div>
            <div>
              <label className="form-field-label">
                排序值
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="form-field-control"
              />
            </div>
            <div className="tool-settings-form-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn-secondary btn-sm">
                  取消编辑
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "保存中..." : editingId ? "更新工具" : "新增工具"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div>
        <div className="tool-list-header">
          <h2>工具列表</h2>
          <span className="entity-card-note">{toolLinks.length} 项</span>
        </div>

        {loading ? (
          <div className="card empty-state empty-state--loading">
            <div className="empty-icon">…</div>
            <strong>正在读取常用工具</strong>
            <p>菜单项会显示在右上角工具入口中。</p>
          </div>
        ) : loadingError ? (
          <div className="card empty-state empty-state--error">
            <div className="empty-icon">!</div>
            <strong>{loadingError}</strong>
            <p>可以稍后重试，不影响工作台和项目数据。</p>
            <div className="empty-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void fetchToolLinks()}>
                重试
              </button>
            </div>
          </div>
        ) : toolLinks.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">🔧</div>
            <strong>还没有常用工具</strong>
            <p>请先添加 JIRA、Gerrit、Jenkins 等链接。</p>
          </div>
        ) : (
          <div className="tool-list-stack">
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
