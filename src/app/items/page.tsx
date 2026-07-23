"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ItemsTable from "@/components/redesign/ItemsTable";
import Icon from "@/components/Icon";
import PageLoadingState from "@/components/PageLoadingState";
import {
  WORK_ITEM_TYPES,
  PRIORITIES,
  STATUSES,
  MODULES,
  HEALTH_OPTIONS,
  REPORT_LEVEL_OPTIONS,
  SOURCE_SYSTEM_OPTIONS,
  PRIORITY_LABELS,
  HEALTH_LABELS,
  STATUS_LABELS,
  WORK_ITEM_TYPE_LABELS,
  REPORT_LEVEL_LABELS,
  SOURCE_SYSTEM_LABELS,
} from "@/lib/constants";
import { buildItemsQueryString } from "@/lib/filterLinks";
import { REPORT_QUALITY_LABELS, isReportQuality } from "@/lib/reportReadiness";

type ItemFilters = {
  projectId: string;
  project: string;
  module: string;
  type: string;
  visibility: string;
  priority: string;
  status: string;
  owner: string;
  health: string;
  reportLevel: string;
  sourceSystem: string;
  keyword: string;
  overdue: boolean;
  quality: string;
};

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

const DEFAULT_FILTERS: ItemFilters = {
  projectId: "",
  project: "",
  module: "",
  type: "",
  visibility: "open",
  priority: "",
  status: "",
  owner: "",
  health: "",
  reportLevel: "",
  sourceSystem: "",
  keyword: "",
  overdue: false,
  quality: "",
};

function readItemFilters(searchParams: URLSearchParams): ItemFilters {
  return {
    projectId: searchParams.get("projectId") || "",
    project: searchParams.get("project") || "",
    module: searchParams.get("module") || "",
    type: searchParams.get("type") || "",
    visibility: searchParams.get("visibility") || "open",
    priority: searchParams.get("priority") || "",
    status: searchParams.get("status") || "",
    owner: searchParams.get("owner") || "",
    health: searchParams.get("health") || "",
    reportLevel: searchParams.get("reportLevel") || "",
    sourceSystem: searchParams.get("sourceSystem") || "",
    keyword: searchParams.get("keyword") || "",
    overdue: searchParams.get("overdue") === "true",
    quality: searchParams.get("quality") || "",
  };
}

function hasAdvancedItemFilters(filters: ItemFilters) {
  return Boolean(
    filters.type ||
      filters.priority ||
      filters.status ||
      filters.health ||
      filters.reportLevel ||
      filters.sourceSystem ||
      filters.module ||
      filters.owner ||
      filters.overdue ||
      filters.quality
  );
}

function formatCombinedLabel(value: string, labels: Record<string, string>) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => labels[item] || item)
    .join(" / ");
}

function buildActiveFilterLabels(filters: ItemFilters) {
  const activeLabels: string[] = [];

  if (filters.projectId) activeLabels.push("项目范围");
  else if (filters.project) activeLabels.push(`项目：${filters.project}`);
  if (filters.keyword) activeLabels.push(`关键词：${filters.keyword}`);
  if (filters.visibility === "open") activeLabels.push("未关闭");
  else if (filters.visibility === "closed") activeLabels.push("仅已关闭");
  else if (filters.visibility === "all") activeLabels.push("全部事项");
  if (filters.type) activeLabels.push(`类型：${WORK_ITEM_TYPE_LABELS[filters.type] || filters.type}`);
  if (filters.priority) activeLabels.push(`优先级：${formatCombinedLabel(filters.priority, PRIORITY_LABELS)}`);
  if (filters.status) activeLabels.push(`状态：${STATUS_LABELS[filters.status] || filters.status}`);
  if (filters.health) activeLabels.push(`健康度：${formatCombinedLabel(filters.health, HEALTH_LABELS)}`);
  if (filters.reportLevel) activeLabels.push(`汇报层级：${REPORT_LEVEL_LABELS[filters.reportLevel] || filters.reportLevel}`);
  if (filters.sourceSystem) activeLabels.push(`来源：${SOURCE_SYSTEM_LABELS[filters.sourceSystem] || filters.sourceSystem}`);
  if (filters.module) activeLabels.push(`模块：${filters.module}`);
  if (filters.owner) activeLabels.push(`责任人：${filters.owner}`);
  if (filters.overdue) activeLabels.push("仅显示逾期");
  if (isReportQuality(filters.quality)) activeLabels.push(`汇报缺口：${REPORT_QUALITY_LABELS[filters.quality]}`);

  return activeLabels;
}

function toTime(value?: Date | string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isDateWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const target = new Date(value);
  if (!Number.isFinite(target.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= days;
}

function isDateDueOrPast(value: string | null | undefined) {
  if (!value) return false;
  const target = new Date(value);
  if (!Number.isFinite(target.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target <= today;
}

function isLowActivityItem(item: WorkItem) {
  if (item.status === "closed") return false;
  if (item.priority === "P0" || item.priority === "P1") return false;
  if (item.status === "blocked") return false;
  if (item.health === "red") return false;
  if (item.dueDate && isDateDueOrPast(item.dueDate)) return false;
  if (isDateWithinDays(item.dueDate, 7)) return false;
  if (isDateDueOrPast(item.nextCheckpoint)) return false;

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  return toTime(item.updatedAt) < thirtyDaysAgo;
}

export default function ItemsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [urlFiltersInitialized, setUrlFiltersInitialized] = useState(false);
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [hideLowActivity, setHideLowActivity] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildItemsQueryString(filters, { page, pageSize: 20 });
      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const nextFilters = readItemFilters(new URLSearchParams(searchParams.toString()));
    setFilters((current) =>
      JSON.stringify(current) === JSON.stringify(nextFilters) ? current : nextFilters
    );
    if (hasAdvancedItemFilters(nextFilters)) setShowAdvancedFilters(true);
    setPage(1);
    setUrlFiltersInitialized(true);
  }, [searchParams]);

  useEffect(() => {
    if (!urlFiltersInitialized) return;

    const delay = filters.keyword ? 250 : 0;
    const timer = window.setTimeout(() => {
      fetchItems();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [fetchItems, filters.keyword, urlFiltersInitialized]);

  useEffect(() => {
    if (!urlFiltersInitialized) return;

    const syncUrl = () => {
      const nextQuery = buildItemsQueryString(filters);
      const currentQuery = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
      if (currentQuery === nextQuery) return;

      const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextHref, { scroll: false });
    };

    const delay = filters.keyword ? 250 : 0;
    const timer = window.setTimeout(syncUrl, delay);
    return () => window.clearTimeout(timer);
  }, [filters, page, pathname, router, urlFiltersInitialized]);

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setShowAdvancedFilters(false);
  };

  const applyQuickView = (nextFilters: Partial<ItemFilters>) => {
    const nextState = { ...DEFAULT_FILTERS, ...nextFilters };
    setFilters(nextState);
    setPage(1);
    setShowAdvancedFilters(hasAdvancedItemFilters(nextState));
  };

  const quickViews = useMemo(
    () => [
      { label: "未关闭", filters: { visibility: "open" } },
      { label: "P0 高优", filters: { visibility: "open", priority: "P0" } },
      { label: "阻塞", filters: { visibility: "open", status: "blocked" } },
      { label: "风险红", filters: { visibility: "open", health: "red" } },
      { label: "逾期", filters: { visibility: "open", overdue: true } },
      { label: "进入日报", filters: { visibility: "open", reportLevel: "daily" } },
    ],
    []
  );

  const isQuickViewActive = (nextFilters: Partial<ItemFilters>) => {
    const expected = { ...DEFAULT_FILTERS, ...nextFilters };
    return Object.keys(DEFAULT_FILTERS).every((key) => {
      const filterKey = key as keyof ItemFilters;
      return filters[filterKey] === expected[filterKey];
    });
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

  const activeFilterLabels = buildActiveFilterLabels(filters);
  const itemsWithActivitySignal = items.map((item) => ({
    item,
    lowActivity: isLowActivityItem(item),
  }));
  const visibleItems = hideLowActivity
    ? itemsWithActivitySignal.filter((entry) => !entry.lowActivity)
    : itemsWithActivitySignal;
  const lowActivityCount = itemsWithActivitySignal.filter((entry) => entry.lowActivity).length;

  return (
    <div className="command-list-page item-list-page">
      {/* Header */}
      <div className="command-page-header">
        <div>
          <span className="section-eyebrow">EXECUTION QUEUE</span>
          <h1>工作事项</h1>
          <p>EXECUTION QUEUE · {total} 条事项</p>
        </div>
        <div className="page-header-actions">
          <button onClick={copyMarkdown} className="btn btn-secondary list-action-button">
            <Icon name="copy" size={14} />复制 Markdown
          </button>
          <Link href="/items/new" className="btn btn-primary"><Icon name="plus" size={14} />新建事项</Link>
        </div>
      </div>

      <div className="card item-quick-view-panel">
        <div className="item-quick-view-head">
          <span>快速视图</span>
          <strong>SORTED · UPDATED DESC</strong>
        </div>
        <div className="item-quick-view-actions">
          {quickViews.map((view) => (
            <button
              key={view.label}
              type="button"
              onClick={() => applyQuickView(view.filters)}
              className={`item-quick-chip${isQuickViewActive(view.filters) ? " is-active" : ""}`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card filter-panel item-filter-panel">
        <div className="item-filter-toolbar">
          <div className="item-filter-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="搜索标题、说明、负责人"
              value={filters.keyword}
              onChange={(e) => handleFilterChange("keyword", e.target.value)}
            />
          </div>
          <select
            value={filters.visibility}
            onChange={(e) => handleFilterChange("visibility", e.target.value)}
          >
            <option value="open">默认未关闭</option>
            <option value="closed">仅已关闭</option>
            <option value="all">全部事项</option>
          </select>
          {activeFilterLabels.length > 0 && (
            <button type="button" onClick={clearFilters} className="btn btn-ghost item-filter-clear">
              清除筛选
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost item-filter-advanced-toggle"
            aria-expanded={showAdvancedFilters}
            onClick={() => setShowAdvancedFilters((current) => !current)}
          >
            {showAdvancedFilters ? "收起高级筛选" : "展开高级筛选"}
          </button>
        </div>
        <div className="filter-panel-label"><Icon name="search" size={14} />高级筛选</div>
        {activeFilterLabels.length > 0 && (
          <div className="filter-scope-note active-filter-summary">
            {activeFilterLabels.map((label) => (
              <span key={label} className="entity-pill entity-pill--muted">{label}</span>
            ))}
          </div>
        )}
        <div className={`filter-grid item-filter-advanced${showAdvancedFilters ? " is-open" : ""}`}>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange("type", e.target.value)}
          >
            <option value="">全部类型</option>
            {WORK_ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) => handleFilterChange("priority", e.target.value)}
          >
            <option value="">全部优先级</option>
            <option value="P0,P1">P0/P1</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="">全部状态</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filters.health}
            onChange={(e) => handleFilterChange("health", e.target.value)}
          >
            <option value="">全部健康度</option>
            <option value="red,yellow">风险/关注</option>
            {HEALTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.reportLevel}
            onChange={(e) => handleFilterChange("reportLevel", e.target.value)}
          >
            <option value="">全部汇报层级</option>
            {REPORT_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.sourceSystem}
            onChange={(e) => handleFilterChange("sourceSystem", e.target.value)}
          >
            <option value="">全部来源系统</option>
            {SOURCE_SYSTEM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={filters.module}
            onChange={(e) => handleFilterChange("module", e.target.value)}
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
          />
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(e) => handleFilterChange("overdue", e.target.checked)}
            />
            仅显示逾期
          </label>
          {filters.quality && (
            <div className="field-help" style={{ alignSelf: "center" }}>
              当前为汇报入口的质量筛选，可清除后切换其他条件。
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="item-low-activity-row">
        <button
          type="button"
          className={`item-quick-chip${hideLowActivity ? " is-active" : ""}`}
          onClick={() => setHideLowActivity((value) => !value)}
          title="仅对普通、未关闭、超过 30 天无更新且无临近风险的事项生效"
        >
          {hideLowActivity ? "已隐藏低活跃" : "隐藏低活跃"}（{lowActivityCount}）
        </button>
      </div>
      <div className="command-list-count">
        共 {total} 条记录
      </div>

      {/* Items List */}
      {loading ? (
        <PageLoadingState
          title="加载事项列表..."
          description="正在读取筛选后的事项与当前状态。"
          rows={4}
        />
      ) : visibleItems.length === 0 ? (
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
        <ItemsTable items={visibleItems} />
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="pagination-row">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary"
          >
            上一页
          </button>
          <span className="pagination-status">
            第 {page} 页 / 共 {Math.ceil(total / 20)} 页
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="btn btn-secondary"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
