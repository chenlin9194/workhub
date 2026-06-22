"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WorkItemCard from "@/components/WorkItemCard";
import { WORK_ITEM_TYPES, PRIORITIES, STATUSES, MODULES } from "@/lib/constants";

interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  project?: string | null;
  module?: string | null;
  type: string;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
}

export default function ItemsPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    project: "",
    module: "",
    type: "",
    priority: "",
    status: "",
    owner: "",
    keyword: "",
    overdue: false,
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.project) params.set("project", filters.project);
      if (filters.module) params.set("module", filters.module);
      if (filters.type) params.set("type", filters.type);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.status) params.set("status", filters.status);
      if (filters.owner) params.set("owner", filters.owner);
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.overdue) params.set("overdue", "true");
      params.set("page", page.toString());
      params.set("pageSize", "20");

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [page, filters]);

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      project: "",
      module: "",
      type: "",
      priority: "",
      status: "",
      owner: "",
      keyword: "",
      overdue: false,
    });
    setPage(1);
  };

  const copyMarkdown = () => {
    let md = "# 工作事项列表\n\n";
    items.forEach((item) => {
      md += `## ${item.title}\n`;
      md += `- **类型**: ${item.type} | **优先级**: ${item.priority} | **状态**: ${item.status}\n`;
      if (item.project) md += `- **项目**: ${item.project}\n`;
      if (item.owner) md += `- **责任人**: ${item.owner}\n`;
      if (item.dueDate) md += `- **截止日期**: ${item.dueDate}\n`;
      md += "\n";
    });
    navigator.clipboard.writeText(md);
    alert("已复制到剪贴板");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>工作事项</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyMarkdown} className="btn btn-secondary" style={{ fontSize: 13 }}>
            复制 Markdown
          </button>
          <Link href="/items/new" className="btn btn-primary">+ 新建跟踪事项</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          <input
            type="text"
            placeholder="关键词搜索"
            value={filters.keyword}
            onChange={(e) => handleFilterChange("keyword", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          />
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange("type", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部类型</option>
            {WORK_ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) => handleFilterChange("priority", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部优先级</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部状态</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filters.module}
            onChange={(e) => handleFilterChange("module", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部模块</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="责任人"
            value={filters.owner}
            onChange={(e) => handleFilterChange("owner", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(e) => handleFilterChange("overdue", e.target.checked)}
            />
            仅显示逾期
          </label>
          <button onClick={clearFilters} className="btn btn-ghost" style={{ fontSize: 13 }}>
            清除筛选
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
        共 {total} 条记录
      </div>

      {/* Items List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📋</div>
          暂无事项，可先新建跟踪事项来记录需要闭环的风险、问题、待办或跨团队依赖。
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {items.map((item) => (
            <WorkItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
          >
            上一页
          </button>
          <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: "var(--text-tertiary)" }}>
            第 {page} 页 / 共 {Math.ceil(total / 20)} 页
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
