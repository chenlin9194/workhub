"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import WbsTemplateManager from "@/components/WbsTemplateManager";

interface ToolLink {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function getDisplayUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}

function ToolLinkRow({
  tool,
  sortOrder,
  onSortChange,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  tool: ToolLink;
  sortOrder: string;
  onSortChange: (toolId: string, value: string) => void;
  onEdit: (tool: ToolLink) => void;
  onDelete: (tool: ToolLink) => void;
  onToggleEnabled: (tool: ToolLink) => Promise<void>;
}) {
  return (
    <div className="tool-table-row">
      <div className="tool-table-name">
        <a href={tool.url} target="_blank" rel="noopener noreferrer">
          {tool.name}
        </a>
        <span className={`entity-pill ${tool.enabled ? "entity-pill--success" : "entity-pill--muted"}`}>
          {tool.enabled ? "已启用" : "已停用"}
        </span>
      </div>

      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer"
        title={tool.url}
        className="tool-table-url"
      >
        <Icon name="external-link" size={12} />
        {getDisplayUrl(tool.url)}
      </a>

      <div className="tool-table-status">
        <span className={`entity-pill ${tool.enabled ? "entity-pill--success" : "entity-pill--muted"}`}>
          {tool.enabled ? "已启用" : "已停用"}
        </span>
      </div>

      <div className="tool-table-sort">
        <input
          type="number"
          value={sortOrder}
          onChange={(event) => onSortChange(tool.id, event.target.value)}
          className="form-field-control tool-sort-input"
          aria-label={`${tool.name} 排序值`}
        />
      </div>

      <div className="tool-table-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(tool)}>
          编辑
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onToggleEnabled(tool)}>
          {tool.enabled ? "停用" : "启用"}
        </button>
        <button className="btn btn-ghost btn-sm tool-delete-button" onClick={() => onDelete(tool)}>
          删除
        </button>
      </div>
    </div>
  );
}

export default function ToolSettingsPage() {
  const [toolLinks, setToolLinks] = useState<ToolLink[]>([]);
  const [sortDrafts, setSortDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSort, setSavingSort] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
      const links: ToolLink[] = data.toolLinks || [];
      setToolLinks(links);
      setSortDrafts(Object.fromEntries(links.map((tool) => [tool.id, String(tool.sortOrder)])));
    } catch (error) {
      console.error("Error fetching tool links:", error);
      setToolLinks([]);
      setSortDrafts({});
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
    setShowForm(false);
    setForm({
      name: "",
      url: "",
      enabled: true,
      sortOrder: "0",
    });
  };

  const beginCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      url: "",
      enabled: true,
      sortOrder: "0",
    });
    setShowForm(true);
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
    setShowForm(true);
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
      if (editingId === tool.id) resetForm();
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

  const handleSaveSortOrders = async () => {
    const changedTools = toolLinks.filter((tool) => Number(sortDrafts[tool.id]) !== tool.sortOrder);
    if (changedTools.length === 0) return;

    setSavingSort(true);
    try {
      const results = await Promise.all(
        changedTools.map((tool) =>
          fetch(`/api/tool-links/${tool.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: Number(sortDrafts[tool.id]) || 0 }),
          })
        )
      );

      if (results.some((res) => !res.ok)) {
        alert("保存排序失败");
        return;
      }

      await fetchToolLinks();
    } catch (error) {
      console.error("Error saving sort orders:", error);
      alert("保存排序失败");
    } finally {
      setSavingSort(false);
    }
  };

  const enabledTools = toolLinks.filter((tool) => tool.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const disabledToolCount = toolLinks.length - enabledTools.length;
  const sortChanged = toolLinks.some((tool) => Number(sortDrafts[tool.id]) !== tool.sortOrder);

  return (
    <div className="page-shell auxiliary-page tool-settings-page tool-console-page tool-drawer-page">
      <div className="command-page-header tool-settings-header">
        <div>
          <span className="section-eyebrow">TOOLS / SETUP</span>
          <h1>工具入口</h1>
          <p>维护右上角常用工具菜单，只做外部链接跳转，不做登录、OAuth、API 同步。</p>
        </div>
        <div className="page-header-actions">
          <Link href="/" className="btn btn-secondary btn-sm">
            返回工作台
          </Link>
        </div>
      </div>

      <WbsTemplateManager />

      <section className="card tool-console-summary tool-drawer-summary">
        <div className="tool-drawer-summary-main">
          <div>
            <span className="section-eyebrow">TOOL MENU</span>
            <h2>工具菜单状态</h2>
          </div>
          <p>
            启用 {enabledTools.length} · 停用 {disabledToolCount} · 按排序值从小到大展示
          </p>
          <small>只维护右上角菜单的跳转链接，不保存凭据。</small>
        </div>
        <div className="tool-drawer-preview">
          <span>菜单预览</span>
          <div>
            {enabledTools.length === 0 ? (
              <small>暂无启用工具</small>
            ) : (
              enabledTools.map((tool) => (
                <a key={tool.id} href={tool.url} target="_blank" rel="noopener noreferrer">
                  {tool.name}
                </a>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="tool-list-section">
        <div className="tool-list-header">
          <div>
            <h2>工具列表</h2>
            <span className="entity-card-note">{toolLinks.length} 项</span>
          </div>
          <div className="tool-list-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSaveSortOrders} disabled={!sortChanged || savingSort}>
              {savingSort ? "保存中..." : "保存排序"}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={beginCreate}>
              + 新增工具
            </button>
          </div>
        </div>

        {showForm && (
          <div className="card form-card tool-settings-form-card tool-inline-form-card">
            <div className="form-section-header">
              <h2>{editingId ? "编辑工具" : "新增工具"}</h2>
              <p>只填写名称、链接、启用状态和排序值。</p>
            </div>
            <form onSubmit={handleSubmit} className="tool-settings-form">
              <div className="tool-settings-primary-grid">
                <div>
                  <label className="form-field-label">名称 *</label>
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
                  <label className="form-field-label">链接 *</label>
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
                  <label className="form-field-label">启用</label>
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
                  <label className="form-field-label">排序值</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className="form-field-control"
                  />
                </div>
                <div className="tool-settings-form-actions">
                  <button type="button" onClick={resetForm} className="btn btn-secondary btn-sm">
                    取消
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? "保存中..." : editingId ? "更新工具" : "新增工具"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

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
            <div className="empty-icon">+</div>
            <strong>还没有常用工具</strong>
            <p>先添加 JIRA、Gerrit、Jenkins 等外部链接。</p>
          </div>
        ) : (
          <div className="card tool-table-card">
            <div className="tool-table-head">
              <span>名称</span>
              <span>链接</span>
              <span>状态</span>
              <span>排序</span>
              <span>操作</span>
            </div>
            <div className="tool-table-body">
              {toolLinks.map((tool) => (
                <ToolLinkRow
                  key={tool.id}
                  tool={tool}
                  sortOrder={sortDrafts[tool.id] ?? String(tool.sortOrder)}
                  onSortChange={(toolId, value) => setSortDrafts((prev) => ({ ...prev, [toolId]: value }))}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleEnabled={handleToggleEnabled}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="tool-boundary-note">
        这里只维护右上角工具菜单的外部链接。WorkHub 不检测连接状态，不保存账号凭据，也不做第三方系统同步。
      </div>
    </div>
  );
}
