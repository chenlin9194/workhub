"use client";

import Link from "next/link";
import { WORK_LOG_TYPE_LABELS } from "@/lib/constants";

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
              <Link
                key={log.id}
                href={`/logs/${log.id}`}
                style={{ textDecoration: "none", display: "block", marginBottom: 8 }}
              >
                <div className="card card-hover" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span className="badge" style={{ fontSize: 10, background: "var(--accent-purple)", color: "white" }}>
                      {WORK_LOG_TYPE_LABELS[log.type] || log.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                    {log.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.content}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
