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
    nextAction?: string | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date | null;
  };
}

export default function WorkItemCard({ item }: WorkItemCardProps) {
  const overdue = isOverdue(item.dueDate, item.status);
  const blocked = item.status === "blocked";
  const closed = item.status === "closed";

  return (
    <Link
      href={`/items/${item.id}`}
      className={`card card-hover work-item-card priority-${item.priority.toLowerCase()}${blocked ? " is-blocked" : ""}${closed ? " is-closed" : ""}${overdue ? " is-overdue" : ""}`}
    >
      <div className="work-card-heading">
        <div className="work-card-badges">
          <span className={`badge badge-${item.priority.toLowerCase()}`}>
            {PRIORITY_LABELS[item.priority] || item.priority}
          </span>
          <span className={`badge badge-${item.status}`}>
            {blocked && <Icon name="alert-triangle" size={11} />}
            {STATUS_LABELS[item.status] || item.status}
          </span>
          {overdue && <span className="badge badge-overdue"><Icon name="clock" size={11} />逾期</span>}
        </div>
        <h3>{item.title}</h3>
        {item.description && <p className="work-card-description">{item.description}</p>}
      </div>

      {item.nextAction && (
        <div className="next-action-box">
          <span><Icon name="chevron-right" size={13} />NEXT ACTION</span>
          <strong>{item.nextAction}</strong>
        </div>
      )}

      <div className="work-card-meta">
        <span>{WORK_ITEM_TYPE_LABELS[item.type] || item.type}</span>
        {item.project && <span>{item.project}</span>}
        {item.module && <span>{item.module}</span>}
        {item.owner && <span><Icon name="user" size={11} />{item.owner}</span>}
        {item.dueDate && (
          <span className={overdue ? "meta-overdue" : ""}>
            <Icon name="calendar" size={11} />{overdue ? "已逾期 · " : ""}{item.dueDate}
          </span>
        )}
      </div>
    </Link>
  );
}
