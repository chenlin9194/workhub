"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WorkItemCard from "@/components/WorkItemCard";
import Icon from "@/components/Icon";
import {
  WORK_ITEM_TYPES,
  PRIORITIES,
  STATUSES,
  MODULES,
  HEALTH_OPTIONS,
  REPORT_LEVEL_OPTIONS,
  SOURCE_SYSTEM_OPTIONS,
} from "@/lib/constants";

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
  nextAction?: string | null;
  trackingReason?: string | null;
  sourceSystem?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  health: string;
  currentSummary?: string | null;
  nextCheckpoint?: string | null;
  reportLevel: string;
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
    health: "",
    reportLevel: "",
    sourceSystem: "",
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
      if (filters.health) params.set("health", filters.health);
      if (filters.reportLevel) params.set("reportLevel", filters.reportLevel);
      if (filters.sourceSystem) params.set("sourceSystem", filters.sourceSystem);
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
      health: "",
      reportLevel: "",
      sourceSystem: "",
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
    <div className="command-list-page">
      {/* Header */}
      <div className="command-page-header">
        <div>
          <span className="section-eyebrow">EXECUTION QUEUE</span>
          <h1>工作事项</h1>
          <p>跟踪风险、问题、待办与跨团队依赖的闭环状态。</p>
        </div>
        <div className="page-header-actions">
          <button onClick={copyMarkdown} className="btn btn-secondary" style={{ fontSize: 13 }}>
            <Icon name="copy" size={14} />复制 Markdown
          </button>
          <Link href="/items/new" className="btn btn-primary"><Icon name="plus" size={14} />新建跟踪事项</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card filter-panel">
        <div className="filter-panel-label"><Icon name="search" size={14} />事项筛选</div>
        <div className="filter-grid">
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
            value={filters.health}
            onChange={(e) => handleFilterChange("health", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部健康度</option>
            {HEALTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.reportLevel}
            onChange={(e) => handleFilterChange("reportLevel", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部汇报层级</option>
            {REPORT_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.sourceSystem}
            onChange={(e) => handleFilterChange("sourceSystem", e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">全部来源系统</option>
            {SOURCE_SYSTEM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
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
        <div className="card empty-state compact-list-empty">
          <div className="empty-icon"><Icon name="clipboard-list" size={25} /></div>
          <strong>当前没有匹配的工作事项</strong>
          <p>新建需要持续跟踪的事项，或先记录今天发生的事实。</p>
          <div className="empty-actions">
            <Link href="/items/new" className="btn btn-primary">新建跟踪事项</Link>
            <Link href="/logs/new" className="btn btn-secondary">先记录一条日志</Link>
          </div>
        </div>
      ) : (
        <div className="content-card-grid">
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
