"use client";

import Link from "next/link";
import { WORK_LOG_TYPE_LABELS, SOURCE_LABELS } from "@/lib/constants";

interface WorkLogCardProps {
  log: {
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
  };
  showLink?: boolean;
}

export default function WorkLogCard({ log, showLink = true }: WorkLogCardProps) {
  const content = (
    <div className="card card-hover" style={{ padding: 16, textDecoration: "none", display: "block" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{log.workDate}</span>
            <span className="badge" style={{ fontSize: 10, background: "var(--accent-blue)", color: "white" }}>
              {WORK_LOG_TYPE_LABELS[log.type] || log.type}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {SOURCE_LABELS[log.source] || log.source}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {log.title}
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {log.content}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
        {log.project && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            {log.project}
          </span>
        )}
        {log.module && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            {log.module}
          </span>
        )}
        {log.itemId && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--accent-green)", color: "white", fontSize: 10 }}>
            已关联事项
          </span>
        )}
      </div>
    </div>
  );

  if (showLink) {
    return <Link href={`/logs/${log.id}`} style={{ textDecoration: "none" }}>{content}</Link>;
  }

  return content;
}
