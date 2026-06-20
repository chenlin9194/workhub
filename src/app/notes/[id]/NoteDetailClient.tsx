"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Note } from "@/lib/types";
import Icon from "@/components/Icon";

export default function NoteDetailClient({ note }: { note: Note }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      router.push("/notes");
      router.refresh();
    } catch {
      alert("删除失败，请重试");
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      if (!res.ok) throw new Error("操作失败");
      router.refresh();
    } catch {
      alert("操作失败");
    } finally {
      setClosing(false);
    }
  };

  const handleCopyMarkdown = () => {
    const md = `## [${note.priority}][${TYPE_LABELS[note.type] || note.type}] ${note.title}

- 项目/版本：${note.project || "-"}
- 模块：${note.module || "-"}
- 状态：${STATUS_LABELS[note.status] || note.status}
- 责任人：${note.owner || "-"}
- 截止时间：${note.dueDate || "-"}
- 标签：${note.tags || "-"}

原始内容：
${note.content}`;

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const infoItems = [
    { label: "项目/版本", value: note.project },
    { label: "模块", value: note.module },
    { label: "类型", value: TYPE_LABELS[note.type] },
    { label: "优先级", value: PRIORITY_LABELS[note.priority] },
    { label: "状态", value: STATUS_LABELS[note.status] },
    { label: "来源", value: SOURCE_LABELS[note.source] },
    { label: "责任人", value: note.owner },
    { label: "截止日期", value: note.dueDate },
    { label: "创建时间", value: formatDate(note.createdAt, "full") },
    { label: "更新时间", value: note.updatedAt ? formatDate(note.updatedAt, "full") : null },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Link href="/notes" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}>
          <Icon name="arrow-left" size={14} /> 返回列表
        </Link>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={handleCopyMarkdown} className="btn btn-ghost btn-sm">
            <Icon name="copy" size={14} /> {copied ? "已复制" : "复制 MD"}
          </button>
          {note.status !== "closed" && (
            <button onClick={handleClose} disabled={closing} className="btn btn-success btn-sm" style={{ opacity: closing ? 0.6 : 1 }}>
              <Icon name="check-circle" size={14} /> {closing ? "处理中..." : "关闭"}
            </button>
          )}
          <Link href={`/notes/${note.id}/edit`} className="btn btn-primary btn-sm">
            <Icon name="edit" size={14} /> 编辑
          </Link>
          <button onClick={() => setShowConfirm(true)} className="btn btn-danger btn-sm">
            <Icon name="trash" size={14} /> 删除
          </button>
        </div>
      </div>

      {/* Title + badges */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.4 }}>{note.title}</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className={`badge badge-${note.priority.toLowerCase()}`}>{note.priority}</span>
          <span className={`badge badge-${note.status}`}>{STATUS_LABELS[note.status]}</span>
          <span className={`badge badge-${note.type}`}>{TYPE_LABELS[note.type]}</span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>结构化信息</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {infoItems.map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{item.value || "-"}</div>
            </div>
          ))}
        </div>
        {note.tags && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>标签</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {note.tags.split(",").map((tag, i) => (
                <span key={i} style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 12,
                  background: "var(--accent-blue-light)", color: "var(--accent-blue)",
                }}>
                  #{tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>原始内容</h2>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
          {note.content}
        </div>
      </div>

      {/* Delete Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>确认删除</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
              确定要删除「{note.title}」吗？此操作不可撤销。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} className="btn btn-ghost">取消</button>
              <button onClick={handleDelete} disabled={deleting} className="btn btn-danger" style={{ opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
