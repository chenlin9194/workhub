"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import Timeline from "@/components/Timeline";
import PageLoadingState from "@/components/PageLoadingState";
import {
  WORK_ITEM_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  HEALTH_LABELS,
  REPORT_LEVEL_LABELS,
  SOURCE_SYSTEM_LABELS,
} from "@/lib/constants";
import { isOverdue, generateWorkItemMarkdown } from "@/lib/utils";
import AutoLinkText from "@/components/AutoLinkText";
import ActionItemSection from "@/components/ActionItemSection";
import { itemToAddLogHref, itemToLogsHref } from "@/lib/signalMap";
import WbsExecutionSummary from "@/components/WbsExecutionSummary";

interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  project?: string | null;
  projectId?: string | null;
  module?: string | null;
  type: string;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  tags?: string | null;
  trackingReason?: string | null;
  sourceSystem?: string | null;
  sourceId?: string | null;
  executionMilestoneId?: string | null;
  originWbsNodeId?: string | null;
  managedBy?: string | null;
  sourceUrl?: string | null;
  health: string;
  currentSummary?: string | null;
  nextCheckpoint?: string | null;
  reportLevel: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  logs: {
    id: string;
    workDate: string;
    title: string;
    content: string;
    type: string;
    createdAt: Date;
  }[];
}

function isSystemLog(log: WorkItem["logs"][number]) {
  return log.type === "update" && (
    log.title.startsWith("事项变化：") ||
    log.title.startsWith("浜嬮」鍙樺寲")
  );
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [item, setItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "manual" | "system">("all");
  const [relatedItems, setRelatedItems] = useState<Pick<WorkItem, "id" | "title" | "priority">[]>([]);
  const actionInFlightRef = useRef(false);

  const fetchItem = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${id}`);
      if (res.ok) {
        const data = await res.json();
        setItem(data);
      } else {
        alert("事项不存在");
        router.push("/items");
      }
    } catch (error) {
      console.error("Error fetching item:", error);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  useEffect(() => {
    if (!item?.projectId && !item?.project) {
      setRelatedItems([]);
      return;
    }

    const search = new URLSearchParams({ pageSize: "4" });
    if (item.projectId) search.set("projectId", item.projectId);
    else if (item.project) search.set("project", item.project);

    fetch(`/api/items?${search.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setRelatedItems((data?.items || []).filter((candidate: WorkItem) => candidate.id !== item.id).slice(0, 3)))
      .catch(() => setRelatedItems([]));
  }, [item?.id, item?.project, item?.projectId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!item || actionInFlightRef.current || newStatus === item.status) return;

    actionInFlightRef.current = true;
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchItem();
      } else {
        alert("更新失败");
      }
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!item || actionInFlightRef.current || newPriority === item.priority) return;

    actionInFlightRef.current = true;
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (res.ok) {
        await fetchItem();
      } else {
        alert("更新优先级失败");
      }
    } catch (error) {
      console.error("Error updating priority:", error);
      alert("更新优先级失败");
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!item || actionInFlightRef.current) return;
    if (!confirm("确定删除此事项？关联日志不会被删除。")) return;

    const button = e.currentTarget;
    actionInFlightRef.current = true;
    button.disabled = true;
    setDeleting(true);
    let shouldRestoreButton = true;

    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        shouldRestoreButton = false;
        window.location.assign("/items");
        return;
      }
      alert("删除失败，请重试");
    } catch (error) {
      console.error("Error deleting item:", error);
    } finally {
      if (shouldRestoreButton) {
        actionInFlightRef.current = false;
        button.disabled = false;
        setDeleting(false);
      }
    }
  };

  const copyMarkdown = () => {
    if (!item) return;
    navigator.clipboard.writeText(generateWorkItemMarkdown(item));
    alert("已复制到剪贴板");
  };

  if (loading) {
    return (
      <PageLoadingState
        title="加载事项详情..."
        description="正在读取事项主体、时间线和关联记录。"
        rows={5}
      />
    );
  }

  if (!item) return null;

  const overdue = isOverdue(item.dueDate, item.status);
  const addLogHref = itemToAddLogHref(item.id, item.projectId ?? undefined);
  const systemLogs = item.logs.filter(isSystemLog);
  const visibleLogs = timelineFilter === "system"
    ? item.logs.filter(isSystemLog)
    : timelineFilter === "manual"
      ? item.logs.filter((log) => !isSystemLog(log))
      : item.logs;
  const timelineLogs = showAllLogs ? visibleLogs : visibleLogs.slice(0, 3);

  return (
    <div className="detail-page detail-page--item item-detail-command-page">
      <header className="card detail-header">
        <div className="detail-header-main">
          <Link href="/items" className="detail-back-link">
            <Icon name="arrow-left" size={14} />
            返回列表
          </Link>
          <div className="detail-title-row">
            <span className="section-eyebrow">WORK ITEM</span>
            <h1 className="detail-title">{item.title}</h1>
          </div>
          <div className="detail-status-row">
            <span className={`badge badge-${item.priority.toLowerCase()}`}>
              {PRIORITY_LABELS[item.priority] || item.priority}
            </span>
            <span className={`badge badge-${item.status}`}>
              {STATUS_LABELS[item.status] || item.status}
            </span>
            <span className="entity-pill entity-pill--muted">
              {WORK_ITEM_TYPE_LABELS[item.type] || item.type}
            </span>
            <span className="entity-pill entity-pill--muted">
              {HEALTH_LABELS[item.health] || item.health}
            </span>
            {overdue && <span className="badge badge-overdue">逾期</span>}
          </div>
        </div>
        <div className="detail-actions">
          <select
            className="item-status-compact-select"
            value={item.priority}
            onChange={(event) => handlePriorityChange(event.target.value)}
            aria-label="更新事项优先级"
          >
            {PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
          <select
            className="item-status-compact-select"
            value={item.status}
            onChange={(event) => handleStatusChange(event.target.value)}
            aria-label="更新事项状态"
          >
            <option value="open">待处理</option>
            <option value="following">跟进中</option>
            <option value="blocked">已阻塞</option>
            <option value="closed">已关闭</option>
          </select>
          <button onClick={copyMarkdown} className="btn btn-secondary">
            <Icon name="copy" size={14} />
            复制 Markdown
          </button>
          <Link href={`/items/${item.id}/edit`} className="btn btn-secondary">
            <Icon name="edit" size={14} />
            编辑
          </Link>
          <Link href={addLogHref} className="btn btn-primary">
            <Icon name="plus" size={14} />
            添加日志
          </Link>
          <button onClick={handleDelete} className="btn btn-danger item-delete-quiet" disabled={deleting}>
            {deleting ? "删除中..." : (
              <>
                <Icon name="trash" size={14} />
                删除
              </>
            )}
          </button>
        </div>
      </header>

      <div className="detail-main-grid item-detail-main-grid">
        <section className="card detail-main-card item-summary-card">
          {item.description && (
            <div className="detail-copy-block">
              <div className="detail-field-label">事项描述</div>
              <p className="detail-body-text">
                <AutoLinkText text={item.description} />
              </p>
            </div>
          )}

          <div className="detail-meta-grid">
            <div className="detail-meta-item">
              <span>健康度</span>
              <strong>{HEALTH_LABELS[item.health] || item.health}</strong>
            </div>
            <div className="detail-meta-item">
              <span>汇报层级</span>
              <strong>{REPORT_LEVEL_LABELS[item.reportLevel] || item.reportLevel}</strong>
            </div>
            {item.project && (
              <div className="detail-meta-item">
                <span>项目</span>
                <strong>{item.project}</strong>
              </div>
            )}
            {item.module && (
              <div className="detail-meta-item">
                <span>模块</span>
                <strong>{item.module}</strong>
              </div>
            )}
            {item.owner && (
              <div className="detail-meta-item">
                <span>负责人</span>
                <strong>{item.owner}</strong>
              </div>
            )}
            {item.dueDate && (
              <div className={`detail-meta-item ${overdue ? "detail-meta-item--danger" : ""}`}>
                <span>截止日期</span>
                <strong>{item.dueDate}</strong>
              </div>
            )}
            {item.nextCheckpoint && (
              <div className="detail-meta-item">
                <span>下一检查点</span>
                <strong>{item.nextCheckpoint}</strong>
              </div>
            )}
            {item.sourceSystem && (
              <div className="detail-meta-item">
                <span>来源系统</span>
                <strong>{SOURCE_SYSTEM_LABELS[item.sourceSystem] || item.sourceSystem}</strong>
              </div>
            )}
            {item.sourceId && (
              <div className="detail-meta-item">
                <span>来源编号</span>
                <strong>{item.sourceId}</strong>
              </div>
            )}
            {item.sourceUrl && (
              <div className="detail-meta-item detail-meta-item--wide">
                <span>来源链接</span>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                  打开来源链接
                </a>
              </div>
            )}
            <div className="detail-meta-item">
              <span>创建时间</span>
              <strong>{new Date(item.createdAt).toLocaleString("zh-CN")}</strong>
            </div>
            <div className="detail-meta-item">
              <span>更新时间</span>
              <strong>{new Date(item.updatedAt).toLocaleString("zh-CN")}</strong>
            </div>
          </div>

          {item.tags && (
            <div className="detail-tag-row">
              {item.tags.split(",").map((tag) => (
                <span key={tag.trim()} className="entity-pill entity-pill--muted">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </section>

        <aside className="item-action-items-column">
          <section className="card detail-side-panel item-progress-panel">
            <div className="detail-section-heading">
              <div>
                <span className="section-eyebrow">CURRENT PROGRESS</span>
                <h2>当前进展</h2>
              </div>
            </div>
            <div className="detail-side-panel-body">
              <div className="detail-side-entry">
                <span>进展摘要</span>
                <strong>{item.currentSummary ? <AutoLinkText text={item.currentSummary} /> : "暂未补充进展摘要"}</strong>
              </div>
              <div className="detail-side-entry detail-side-entry--accent">
                <span>下一行动</span>
                <strong>{item.nextAction ? <AutoLinkText text={item.nextAction} /> : "暂未设置下一行动"}</strong>
              </div>
              {item.nextCheckpoint && (
                <div className="detail-side-entry">
                  <span>下一检查点</span>
                  <strong className="mono">{item.nextCheckpoint}</strong>
                </div>
              )}
              {item.trackingReason && (
                <div className="detail-side-entry">
                  <span>跟踪原因</span>
                  <strong><AutoLinkText text={item.trackingReason} /></strong>
                </div>
              )}
            </div>
          </section>
          <ActionItemSection workItemId={item.id} projectId={item.projectId ?? undefined} />
          <section className="card detail-side-panel item-relations-panel">
            <div className="detail-section-heading">
              <div>
                <span className="section-eyebrow">RELATIONS</span>
                <h2>关联</h2>
              </div>
            </div>
            <div className="detail-side-panel-body item-relations-list">
              {item.project && <span>项目：{item.project}</span>}
              {item.module && <span>模块：{item.module}</span>}
              {item.sourceSystem && <span>来源：{SOURCE_SYSTEM_LABELS[item.sourceSystem] || item.sourceSystem}{item.sourceId ? ` · ${item.sourceId}` : ""}</span>}
              {item.projectId && <Link href={`/items?project=${item.projectId}`}>查看同项目事项</Link>}
              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">打开来源链接</a>}
              {relatedItems.length > 0 && (
                <div className="item-related-items">
                  <span>相关事项</span>
                  {relatedItems.map((related) => (
                    <Link key={related.id} href={`/items/${related.id}`}>
                      <b>{PRIORITY_LABELS[related.priority] || related.priority}</b>{related.title}
                    </Link>
                  ))}
                </div>
              )}
              {!item.project && !item.module && !item.sourceSystem && !item.sourceUrl && <span>暂无关联信息</span>}
            </div>
          </section>
        </aside>
      </div>

      <section className="card detail-section-card item-related-log-section">
        <div className="detail-section-heading">
          <div>
            <span className="section-eyebrow">TIMELINE</span>
            <h2>时间线 · 事实与进展</h2>
          </div>
          <Link href={itemToLogsHref(item.id)} className="section-link">
            查看全部 <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="item-related-log-controls">
          {visibleLogs.length > 3 && (
            <button type="button" className="btn btn-secondary" onClick={() => setShowAllLogs((value) => !value)}>
              {showAllLogs ? "收起日志" : "展开全部日志"}（{visibleLogs.length}）
            </button>
          )}
          <button type="button" className={`btn ${timelineFilter === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTimelineFilter("all")}>全部（{item.logs.length}）</button>
          <button type="button" className={`btn ${timelineFilter === "manual" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTimelineFilter("manual")}>仅人工（{item.logs.length - systemLogs.length}）</button>
          {systemLogs.length > 0 && <button type="button" className={`btn ${timelineFilter === "system" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTimelineFilter("system")}>仅系统（{systemLogs.length}）</button>}
        </div>
        <Timeline logs={timelineLogs} />
        <div className="item-static-composer" aria-label="追加事实输入区">
          <textarea readOnly placeholder="追加一条事实…（请通过添加日志提交）" />
          <Link href={addLogHref} className="btn btn-secondary">添加日志</Link>
        </div>
      </section>

      {item.managedBy === "wbs" && item.projectId && (
        <WbsExecutionSummary
          projectId={item.projectId}
          originWbsNodeId={item.originWbsNodeId}
          executionMilestoneId={item.executionMilestoneId}
        />
      )}
    </div>
  );
}
