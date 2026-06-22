"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WorkLogCard from "@/components/WorkLogCard";
import Icon from "@/components/Icon";
import { WORK_LOG_TYPES, SOURCES } from "@/lib/constants";

interface WorkLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  type: string;
  source: string;
  project?: string | null;
  module?: string | null;
  itemId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    project: "",
    module: "",
    type: "",
    source: "",
    hasItem: "",
    keyword: "",
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.project) params.set("project", filters.project);
      if (filters.module) params.set("module", filters.module);
      if (filters.type) params.set("type", filters.type);
      if (filters.source) params.set("source", filters.source);
      if (filters.hasItem) params.set("hasItem", filters.hasItem);
      if (filters.keyword) params.set("keyword", filters.keyword);
      params.set("page", page.toString());
      params.set("pageSize", "20");

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      project: "",
      module: "",
      type: "",
      source: "",
      hasItem: "",
      keyword: "",
    });
    setPage(1);
  };

  const copyMarkdown = () => {
    let md = "# 工作日志列表\n\n";
    logs.forEach((log) => {
      md += `## ${log.title}\n`;
      md += `- **日期**: ${log.workDate} | **类型**: ${log.type} | **来源**: ${log.source}\n`;
      if (log.project) md += `- **项目**: ${log.project}\n`;
      md += `\n${log.content}\n\n`;
    });
    navigator.clipboard.writeText(md);
    alert("已复制到剪贴板");
  };

  return (
    <div className="command-list-page">
      <div className="command-page-header">
        <div>
          <span className="section-eyebrow">SIGNAL ARCHIVE</span>
          <h1>工作日志</h1>
          <p>回看会议、进展、风险与决策留下的事实记录。</p>
        </div>
        <div className="page-header-actions">
          <button onClick={copyMarkdown} className="btn btn-secondary" style={{ fontSize: 13 }}><Icon name="copy" size={14} />复制 Markdown</button>
          <Link href="/logs/new" className="btn btn-primary"><Icon name="plus" size={14} />新增日志</Link>
        </div>
      </div>

      <div className="card filter-panel">
        <div className="filter-panel-label"><Icon name="search" size={14} />日志筛选</div>
        <div className="filter-grid">
          <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
          <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
          <input type="text" placeholder="关键词搜索" value={filters.keyword} onChange={(e) => handleFilterChange("keyword", e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
          <select value={filters.type} onChange={(e) => handleFilterChange("type", e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
            <option value="">全部类型</option>
            {WORK_LOG_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <select value={filters.source} onChange={(e) => handleFilterChange("source", e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
            <option value="">全部来源</option>
            {SOURCES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
          <select value={filters.hasItem} onChange={(e) => handleFilterChange("hasItem", e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
            <option value="">全部关联</option>
            <option value="true">已关联事项</option>
            <option value="false">未关联事项</option>
          </select>
          <button onClick={clearFilters} className="btn btn-ghost" style={{ fontSize: 13 }}>清除筛选</button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>共 {total} 条记录</div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>
      ) : logs.length === 0 ? (
        <div className="card empty-state compact-list-empty">
          <div className="empty-icon"><Icon name="file-text" size={25} /></div>
          <strong>当前没有匹配的工作日志</strong>
          <p>记录一条今天发生的事实，后续需要闭环时再关联事项。</p>
          <div className="empty-actions"><Link href="/logs/new" className="btn btn-primary">记录今日进展</Link></div>
        </div>
      ) : (
        <div className="content-card-grid">
          {logs.map((log) => (<WorkLogCard key={log.id} log={log} />))}
        </div>
      )}

      {total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary" style={{ fontSize: 13 }}>上一页</button>
          <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: "var(--text-tertiary)" }}>第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="btn btn-secondary" style={{ fontSize: 13 }}>下一页</button>
        </div>
      )}
    </div>
  );
}
