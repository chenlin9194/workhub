"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { WORK_LOG_TYPE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { generateWorkLogMarkdown } from "@/lib/utils";
import AutoLinkText from "@/components/AutoLinkText";

interface WorkLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  type: string;
  source: string;
  project?: string | null;
  module?: string | null;
  tags?: string | null;
  itemId?: string | null;
  item?: { id: string; title: string } | null;
  reportable: boolean;
  sourceUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function LogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [log, setLog] = useState<WorkLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLog();
  }, [params.id]);

  const fetchLog = async () => {
    try {
      const res = await fetch(`/api/logs/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setLog(data);
      } else {
        alert("日志不存在");
        router.push("/logs");
      }
    } catch (error) {
      console.error("Error fetching log:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!log) return;
    if (!confirm("确定删除此日志？")) return;

    try {
      const res = await fetch(`/api/logs/${log.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        router.push("/logs");
      } else {
        alert("删除失败");
      }
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const copyMarkdown = () => {
    if (!log) return;
    const md = generateWorkLogMarkdown(log);
    navigator.clipboard.writeText(md);
    alert("已复制到剪贴板");
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>;
  }

  if (!log) {
    return null;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/logs" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>← 返回列表</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{log.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyMarkdown} className="btn btn-secondary" style={{ fontSize: 13 }}>复制 Markdown</button>
          <Link href={`/logs/${log.id}/edit`} className="btn btn-secondary" style={{ fontSize: 13 }}>编辑</Link>
          <button onClick={handleDelete} className="btn btn-secondary" style={{ fontSize: 13, color: "var(--accent-red)" }}>删除</button>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{log.workDate}</span>
          <span className="badge" style={{ background: "var(--accent-blue)", color: "white" }}>{WORK_LOG_TYPE_LABELS[log.type] || log.type}</span>
          <span style={{ padding: "4px 8px", borderRadius: 6, background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12 }}>{SOURCE_LABELS[log.source] || log.source}</span>
        </div>

        <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 16 }}>
          <AutoLinkText text={log.content} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className="badge" style={{ background: log.reportable ? "var(--accent-green)" : "var(--bg-tertiary)", color: log.reportable ? "white" : "var(--text-primary)" }}>
            {log.reportable ? "可汇报" : "不可汇报"}
          </span>
          {log.sourceUrl && (
            <a href={log.sourceUrl} target="_blank" rel="noreferrer" className="badge" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", textDecoration: "none" }}>
              来源链接
            </a>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, fontSize: 13 }}>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>汇报状态</span>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.reportable ? "可汇报" : "不可汇报"}</div>
          </div>
          {log.project && (<div><span style={{ color: "var(--text-tertiary)" }}>项目</span><div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.project}</div></div>)}
          {log.module && (<div><span style={{ color: "var(--text-tertiary)" }}>模块</span><div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.module}</div></div>)}
          {log.sourceUrl && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>来源链接</span>
              <div>
                <a href={log.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>
                  {log.sourceUrl}
                </a>
              </div>
            </div>
          )}
          {log.item && (
            <div>
              <span style={{ color: "var(--text-tertiary)" }}>关联事项</span>
              <div><Link href={`/items/${log.item.id}`} style={{ color: "var(--accent-blue)", textDecoration: "none" }}>{log.item.title}</Link></div>
            </div>
          )}
          <div><span style={{ color: "var(--text-tertiary)" }}>创建时间</span><div style={{ color: "var(--text-primary)" }}>{new Date(log.createdAt).toLocaleString("zh-CN")}</div></div>
        </div>

        {log.tags && (
          <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {log.tags.split(",").map((tag, i) => (
              <span key={i} style={{ padding: "2px 8px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 12 }}>{tag.trim()}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
