"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Timeline from "@/components/Timeline";
import {
  WORK_ITEM_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  HEALTH_LABELS,
  REPORT_LEVEL_LABELS,
  SOURCE_SYSTEM_LABELS,
} from "@/lib/constants";
import { isOverdue, generateWorkItemMarkdown } from "@/lib/utils";
import AutoLinkText from "@/components/AutoLinkText";

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
  tags?: string | null;
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
  logs: {
    id: string;
    workDate: string;
    title: string;
    content: string;
    type: string;
    createdAt: Date;
  }[];
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [item, setItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const actionInFlightRef = useRef(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleStatusChange = async (newStatus: string) => {
    if (!item || actionInFlightRef.current) return;

    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchItem();
        router.refresh();
      } else {
        alert("更新失败");
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!item || actionInFlightRef.current) return;
    if (!confirm("确定删除此事项？关联的日志不会被删除。")) return;

    const button = e.currentTarget;
    actionInFlightRef.current = true;
    button.disabled = true;
    button.textContent = "删除中...";
    setDeleting(true);
    let shouldRestoreButton = true;

    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        shouldRestoreButton = false;
        window.location.assign("/items");
        return;
      } else {
        alert("删除失败，请重试");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
    } finally {
      if (shouldRestoreButton) {
        actionInFlightRef.current = false;
        button.disabled = false;
        button.textContent = "删除";
        setDeleting(false);
      }
    }
  };

  const copyMarkdown = () => {
    if (!item) return;
    const md = generateWorkItemMarkdown(item);
    navigator.clipboard.writeText(md);
    alert("已复制到剪贴板");
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>;
  }

  if (!item) {
    return null;
  }

  const overdue = isOverdue(item.dueDate, item.status);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/items" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
            ← 返回列表
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{item.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyMarkdown} className="btn btn-secondary" style={{ fontSize: 13 }}>
            复制 Markdown
          </button>
          <Link href={`/items/${item.id}/edit`} className="btn btn-secondary" style={{ fontSize: 13 }}>
            编辑
          </Link>
          <Link href={`/logs/new?itemId=${item.id}`} className="btn btn-primary" style={{ fontSize: 13 }}>
            添加日志
          </Link>
          <button onClick={handleDelete} className="btn btn-secondary" style={{ fontSize: 13, color: "var(--accent-red)" }} disabled={deleting}>
            {deleting ? "删除中..." : "删除"}
          </button>
        </div>
      </div>

      {/* Main Info */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <span className={`badge badge-${item.priority.toLowerCase()}`}>
            {PRIORITY_LABELS[item.priority] || item.priority}
          </span>
          <span className={`badge badge-${item.status}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
          <span style={{ padding: "4px 8px", borderRadius: 6, background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12 }}>
            {WORK_ITEM_TYPE_LABELS[item.type] || item.type}
          </span>
          {overdue && (
            <span className="badge" style={{ background: "var(--accent-red)", color: "white" }}>
              逾期
            </span>
          )}
        </div>

        {item.description && (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
            <AutoLinkText text={item.description} />
          </p>
        )}

        {(item.currentSummary || item.trackingReason) && (
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            {item.currentSummary && (
              <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-tertiary)" }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>当前摘要</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  <AutoLinkText text={item.currentSummary} />
                </div>
              </div>
            )}
            {item.trackingReason && (
              <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-tertiary)" }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>跟踪原因</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  <AutoLinkText text={item.trackingReason} />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, fontSize: 13 }}>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>健康度</span>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{HEALTH_LABELS[item.health] || item.health}</div>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>汇报层级</span>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{REPORT_LEVEL_LABELS[item.reportLevel] || item.reportLevel}</div>
          </div>
          {item.sourceSystem && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>来源系统</span>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{SOURCE_SYSTEM_LABELS[item.sourceSystem] || item.sourceSystem}</div>
            </div>
          )}
          {item.sourceId && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>来源编号</span>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.sourceId}</div>
            </div>
          )}
          {item.nextCheckpoint && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>下个检查点</span>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.nextCheckpoint}</div>
            </div>
          )}
          {item.project && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>项目</span>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.project}</div>
            </div>
          )}
          {item.module && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>模块</span>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.module}</div>
            </div>
          )}
          {item.owner && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>责任人</span>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.owner}</div>
            </div>
          )}
          {item.dueDate && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>截止日期</span>
              <div style={{ color: overdue ? "var(--accent-red)" : "var(--text-primary)", fontWeight: 500 }}>{item.dueDate}</div>
            </div>
          )}
          {item.sourceUrl && (
            <div style={{ minWidth: 0 }}>
              <span style={{ color: "var(--text-tertiary)" }}>来源链接</span>
              <div style={{ color: "var(--accent-blue)", fontWeight: 500, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  打开来源链接
                </a>
              </div>
            </div>
          )}
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>创建时间</span>
            <div style={{ color: "var(--text-primary)" }}>{new Date(item.createdAt).toLocaleString("zh-CN")}</div>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>更新时间</span>
            <div style={{ color: "var(--text-primary)" }}>{new Date(item.updatedAt).toLocaleString("zh-CN")}</div>
          </div>
        </div>

        {item.nextAction && (
          <div style={{ marginTop: 16, padding: 12, background: "var(--bg-tertiary)", borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>下一步行动</span>
            <div style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 4 }}>
              <AutoLinkText text={item.nextAction} />
            </div>
          </div>
        )}

        {item.tags && (
          <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.tags.split(",").map((tag, i) => (
              <span key={i} style={{ padding: "2px 8px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12 }}>
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status Actions */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>快速操作</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.status !== "open" && (
            <button onClick={() => handleStatusChange("open")} className="btn btn-secondary" style={{ fontSize: 12 }}>
              设为待处理
            </button>
          )}
          {item.status !== "following" && (
            <button onClick={() => handleStatusChange("following")} className="btn btn-secondary" style={{ fontSize: 12 }}>
              设为跟进中
            </button>
          )}
          {item.status !== "blocked" && (
            <button onClick={() => handleStatusChange("blocked")} className="btn btn-secondary" style={{ fontSize: 12 }}>
              设为已阻塞
            </button>
          )}
          {item.status !== "closed" && (
            <button onClick={() => handleStatusChange("closed")} className="btn btn-primary" style={{ fontSize: 12 }}>
              标记为已关闭
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
          关联日志时间线
        </h2>
        <Timeline logs={item.logs} />
      </div>
    </div>
  );
}
