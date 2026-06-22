"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Timeline from "@/components/Timeline";
import { WORK_ITEM_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { isOverdue, generateWorkItemMarkdown } from "@/lib/utils";
import Icon from "@/components/Icon";
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
  const [item, setItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItem();
  }, [params.id]);

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${params.id}`);
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
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!item) return;

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

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm("确定删除此事项？关联的日志不会被删除。")) return;

    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        router.push("/items");
      } else {
        alert("删除失败");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
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
          <button onClick={handleDelete} className="btn btn-secondary" style={{ fontSize: 13, color: "var(--accent-red)" }}>
            删除
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, fontSize: 13 }}>
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
