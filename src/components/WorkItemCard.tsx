"use client";

import Link from "next/link";
import { WORK_ITEM_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { isOverdue } from "@/lib/utils";
import Icon from "./Icon";

interface WorkItemCardProps {
  item: {
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
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date | null;
  };
}

export default function WorkItemCard({ item }: WorkItemCardProps) {
  const overdue = isOverdue(item.dueDate, item.status);

  return (
    <Link
      href={`/items/${item.id}`}
      className="card card-hover"
      style={{ padding: 16, textDecoration: "none", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className={`badge badge-${item.priority.toLowerCase()}`} style={{ fontSize: 10 }}>
              {PRIORITY_LABELS[item.priority] || item.priority}
            </span>
            <span className={`badge badge-${item.status}`} style={{ fontSize: 10 }}>
              {STATUS_LABELS[item.status] || item.status}
            </span>
            {overdue && (
              <span className="badge" style={{ fontSize: 10, background: "var(--accent-red)", color: "white" }}>
                逾期
              </span>
            )}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </h3>
          {item.description && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.description}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
        <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
          {WORK_ITEM_TYPE_LABELS[item.type] || item.type}
        </span>
        {item.project && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            {item.project}
          </span>
        )}
        {item.module && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            {item.module}
          </span>
        )}
        {item.owner && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 2 }}>
            <Icon name="user" size={10} />
            {item.owner}
          </span>
        )}
        {item.dueDate && (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: overdue ? "var(--accent-red)" : "var(--bg-tertiary)", color: overdue ? "white" : "var(--text-secondary)" }}>
            {item.dueDate}
          </span>
        )}
      </div>
    </Link>
  );
}
