"use client";

import Link from "next/link";
import { WORK_LOG_TYPE_LABELS } from "@/lib/constants";
import AutoLinkText from "./AutoLinkText";

interface TimelineProps {
  logs: {
    id: string;
    workDate: string;
    title: string;
    content: string;
    type: string;
    createdAt: Date;
  }[];
}

export default function Timeline({ logs }: TimelineProps) {
  if (logs.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
        暂无关联日志
      </div>
    );
  }

  // Group logs by workDate
  const grouped = logs.reduce((acc, log) => {
    if (!acc[log.workDate]) {
      acc[log.workDate] = [];
    }
    acc[log.workDate].push(log);
    return acc;
  }, {} as Record<string, typeof logs>);

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ position: "relative" }}>
      {/* Timeline line */}
      <div style={{
        position: "absolute",
        left: 12,
        top: 0,
        bottom: 0,
        width: 2,
        background: "var(--border-primary)",
      }} />

      {dates.map((date) => (
        <div key={date} style={{ marginBottom: 20, position: "relative" }}>
          {/* Date header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
            position: "relative",
            zIndex: 1,
          }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--accent-blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {date}
            </span>
          </div>

          {/* Logs for this date */}
          <div style={{ marginLeft: 36 }}>
            {grouped[date].map((log) => (
              <div key={log.id} className="card card-hover" style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="badge" style={{ fontSize: 10, background: "var(--accent-purple)", color: "white" }}>
                      {WORK_LOG_TYPE_LABELS[log.type] || log.type}
                    </span>
                    <Link href={`/logs/${log.id}`} style={{ fontSize: 12, color: "var(--accent-blue)", textDecoration: "none" }}>
                      查看详情
                    </Link>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{log.workDate}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
                  {log.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <AutoLinkText text={log.content} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
