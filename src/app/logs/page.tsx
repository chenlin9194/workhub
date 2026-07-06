"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import WorkLogCard from "@/components/WorkLogCard";
import Icon from "@/components/Icon";
import PageLoadingState from "@/components/PageLoadingState";
import { WORK_LOG_TYPES, SOURCES } from "@/lib/constants";
import { buildLogsQueryString } from "@/lib/filterLinks";
import { getLocalDateString } from "@/lib/utils";

type LogFilters = {
  startDate: string;
  endDate: string;
  projectId: string;
  project: string;
  itemId: string;
  module: string;
  type: string;
  source: string;
  hasItem: string;
  reportable: string;
  view: string;
  keyword: string;
};

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
  reportable: boolean;
  sourceUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_FILTERS: LogFilters = {
  startDate: "",
  endDate: "",
  projectId: "",
  project: "",
  itemId: "",
  module: "",
  type: "",
  source: "",
  hasItem: "",
  reportable: "",
  view: "facts",
  keyword: "",
};

const LOG_VIEW_OPTIONS = [
  { key: "facts", label: "关键事实", hint: "风险、阻塞、决策、问题与可汇报记录" },
  { key: "risk_blocker", label: "风险/阻塞", hint: "只看需要升级或跨团队推动的异常事实" },
  { key: "decision", label: "决策", hint: "只看已经形成结论的记录" },
  { key: "reportable", label: "可汇报", hint: "只看可进入日报/周报/管理汇报的素材" },
  { key: "system", label: "系统动态", hint: "自动记录的事项状态变化，用于追溯，不进入默认关键事实" },
  { key: "all", label: "全部记录", hint: "包含普通记录与系统状态变化" },
] as const;

function readLogFilters(searchParams: URLSearchParams): LogFilters {
  return {
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    projectId: searchParams.get("projectId") || "",
    project: searchParams.get("project") || "",
    itemId: searchParams.get("itemId") || "",
    module: searchParams.get("module") || "",
    type: searchParams.get("type") || "",
    source: searchParams.get("source") || "",
    hasItem: searchParams.get("hasItem") || "",
    reportable: searchParams.get("reportable") || "",
    view: searchParams.get("view") || "facts",
    keyword: searchParams.get("keyword") || "",
  };
}

function getActiveView(filters: LogFilters) {
  if (filters.view === "facts") return "facts";
  if (filters.view === "risk_blocker") return "risk_blocker";
  if (filters.view === "system") return "system";
  if (filters.type === "decision") return "decision";
  if (filters.reportable === "true") return "reportable";
  return "all";
}

export default function LogsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const today = getLocalDateString();
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [urlFiltersInitialized, setUrlFiltersInitialized] = useState(false);
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildLogsQueryString(filters, { page, pageSize: 20 });
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    setFilters(readLogFilters(new URLSearchParams(window.location.search)));
    setUrlFiltersInitialized(true);
  }, []);

  useEffect(() => {
    if (!urlFiltersInitialized) return;

    const delay = filters.keyword ? 250 : 0;
    const timer = window.setTimeout(() => {
      fetchLogs();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [fetchLogs, filters.keyword, urlFiltersInitialized]);

  useEffect(() => {
    if (!urlFiltersInitialized) return;

    const syncUrl = () => {
      const nextQuery = buildLogsQueryString(filters);
      const currentQuery = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
      if (currentQuery === nextQuery) return;

      const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextHref, { scroll: false });
    };

    const delay = filters.keyword ? 250 : 0;
    const timer = window.setTimeout(syncUrl, delay);
    return () => window.clearTimeout(timer);
  }, [filters, page, pathname, router, urlFiltersInitialized]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const applyQuickView = (nextFilters: Partial<LogFilters>) => {
    setFilters({ ...DEFAULT_FILTERS, ...nextFilters });
    setPage(1);
  };

  const applyView = (view: string) => {
    const scopedFilters = {
      projectId: filters.projectId,
      project: filters.project,
      itemId: filters.itemId,
    };

    if (view === "facts") applyQuickView({ ...scopedFilters, view: "facts" });
    else if (view === "risk_blocker") applyQuickView({ ...scopedFilters, view: "risk_blocker" });
    else if (view === "decision") applyQuickView({ ...scopedFilters, view: "", type: "decision" });
    else if (view === "reportable") applyQuickView({ ...scopedFilters, view: "", reportable: "true" });
    else if (view === "system") applyQuickView({ ...scopedFilters, view: "system" });
    else applyQuickView({ ...scopedFilters, view: "" });
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

  const activeView = getActiveView(filters);
  const activeViewHint = LOG_VIEW_OPTIONS.find((view) => view.key === activeView)?.hint;

  return (
    <div className="command-list-page log-list-page">
      <div className="command-page-header">
        <div>
          <span className="section-eyebrow">FACT TIMELINE</span>
          <h1>事实记录台</h1>
          <p>默认只看关键事实与汇报证据，普通状态流进入“全部记录”。</p>
        </div>
        <div className="page-header-actions">
          <button onClick={copyMarkdown} className="btn btn-secondary list-action-button"><Icon name="copy" size={14} />复制 Markdown</button>
          <Link href="/logs/new" className="btn btn-primary"><Icon name="plus" size={14} />新增日志</Link>
        </div>
      </div>

      <div className="card log-quick-view-panel">
        <div className="log-quick-view-head">
          <span>事实分层</span>
          <strong>先回看需要支撑汇报、复盘和解释项目状态的事实</strong>
          {activeViewHint && <p>{activeViewHint}</p>}
        </div>
        <div className="log-quick-view-actions">
          {LOG_VIEW_OPTIONS.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => applyView(view.key)}
              className={`btn ${activeView === view.key ? "btn-primary" : "btn-secondary"}`}
              title={view.hint}
            >
              {view.label}
            </button>
          ))}
          <button type="button" onClick={() => applyQuickView({ startDate: today, endDate: today, view: "" })} className="btn btn-secondary">
            今日日志
          </button>
          <button type="button" onClick={() => applyQuickView({ hasItem: "false", view: "" })} className="btn btn-secondary">
            未关联事项
          </button>
          {filters.projectId || filters.project ? (
            <button
              type="button"
              onClick={() => applyQuickView({ projectId: filters.projectId, project: filters.project, view: "facts" })}
              className="btn btn-secondary"
            >
              项目关键事实
            </button>
          ) : (
            <Link href="/projects" className="btn btn-secondary">
              项目日志
            </Link>
          )}
        </div>
      </div>

      <div className="card filter-panel log-filter-panel">
        <div className="filter-panel-label"><Icon name="search" size={14} />高级筛选</div>
        {filters.projectId && (
          <div className="filter-scope-note">
            当前项目筛选已启用
          </div>
        )}
        {filters.itemId && (
          <div className="filter-scope-note">
            当前事项筛选已启用
          </div>
        )}
        <div className="filter-grid">
          <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} />
          <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} />
          <input type="text" placeholder="关键词搜索" value={filters.keyword} onChange={(e) => handleFilterChange("keyword", e.target.value)} />
          <select value={filters.type} onChange={(e) => handleFilterChange("type", e.target.value)}>
            <option value="">全部类型</option>
            {WORK_LOG_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <select value={filters.source} onChange={(e) => handleFilterChange("source", e.target.value)}>
            <option value="">全部来源</option>
            {SOURCES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
          <select value={filters.reportable} onChange={(e) => handleFilterChange("reportable", e.target.value)}>
            <option value="">全部汇报状态</option>
            <option value="true">仅可汇报</option>
            <option value="false">仅不可汇报</option>
          </select>
          <select value={filters.hasItem} onChange={(e) => handleFilterChange("hasItem", e.target.value)}>
            <option value="">全部关联</option>
            <option value="true">已关联事项</option>
            <option value="false">未关联事项</option>
          </select>
          <button onClick={clearFilters} className="btn btn-ghost">清除筛选</button>
        </div>
      </div>

      <div className="command-list-count">共 {total} 条记录</div>

      {loading ? (
        <PageLoadingState
          title="加载事实记录..."
          description="正在读取筛选后的日志与关联信息。"
          rows={4}
        />
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
        <div className="pagination-row">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary">上一页</button>
          <span className="pagination-status">第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="btn btn-secondary">下一页</button>
        </div>
      )}
    </div>
  );
}
