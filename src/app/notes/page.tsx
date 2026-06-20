"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NoteCard from "@/components/NoteCard";
import Icon from "@/components/Icon";
import { NOTE_TYPES, PRIORITIES, STATUSES, SOURCES, MODULES } from "@/lib/constants";
import type { Note } from "@/lib/types";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [project, setProject] = useState("");
  const [moduleVal, setModuleVal] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (project) params.set("project", project);
      if (moduleVal) params.set("module", moduleVal);
      if (type) params.set("type", type);
      if (priority) params.set("priority", priority);
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("pageSize", "100");

      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setNotes(data.notes);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, project, moduleVal, type, priority, status, source, startDate, endDate]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const hasFilters = project || moduleVal || type || priority || status || source || startDate || endDate;

  const handleReset = () => {
    setKeyword(""); setProject(""); setModuleVal(""); setType("");
    setPriority(""); setStatus(""); setSource(""); setStartDate(""); setEndDate("");
  };

  // Export
  const handleExport = (format: "csv" | "json") => {
    if (format === "json") {
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `work-log-${new Date().toISOString().split("T")[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
    } else {
      const headers = ["标题", "类型", "优先级", "状态", "项目", "模块", "责任人", "截止日期", "来源", "标签", "创建时间"];
      const rows = notes.map((n) => [
        n.title, n.type, n.priority, n.status, n.project || "", n.module || "",
        n.owner || "", n.dueDate || "", n.source, n.tags || "",
        new Date(n.createdAt).toLocaleString("zh-CN"),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `work-log-${new Date().toISOString().split("T")[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>记录列表</h1>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => handleExport("csv")} className="btn btn-ghost btn-sm">
            <Icon name="download" size={14} /> CSV
          </button>
          <button onClick={() => handleExport("json")} className="btn btn-ghost btn-sm">
            <Icon name="download" size={14} /> JSON
          </button>
          <Link href="/notes/new" className="btn btn-primary">
            <Icon name="plus" size={15} /> 新增
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text" placeholder="搜索标题、内容、标签..."
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchNotes()}
              className="input" style={{ paddingLeft: 34 }}
            />
            <Icon name="search" size={15} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-ghost btn-sm" style={{ position: "relative" }}>
            <Icon name="settings" size={14} /> 筛选
            {hasFilters && <span style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: 3, background: "var(--accent-blue)" }} />}
          </button>
          <button onClick={fetchNotes} className="btn btn-primary btn-sm">
            <Icon name="search" size={14} /> 搜索
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-primary)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              <input type="text" placeholder="项目/版本" value={project} onChange={(e) => setProject(e.target.value)} className="input" />
              <select value={moduleVal} onChange={(e) => setModuleVal(e.target.value)} className="input">
                <option value="">全部模块</option>
                {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="">全部类型</option>
                {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
                <option value="">全部优先级</option>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="">全部状态</option>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
                <option value="">全部来源</option>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={handleReset} className="btn btn-ghost btn-sm">重置筛选</button>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: "28px" }}>共 {total} 条</span>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", background: "var(--accent-red-light)", color: "var(--accent-red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card empty-state"><div style={{ fontSize: 14 }}>加载中...</div></div>
      ) : notes.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📋</div>
          暂无记录
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {notes.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      )}
    </div>
  );
}
