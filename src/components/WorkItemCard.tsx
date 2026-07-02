"use client";

import Link from "next/link";
import {
  WORK_ITEM_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  HEALTH_LABELS,
  REPORT_LEVEL_LABELS,
  SOURCE_SYSTEM_LABELS,
} from "@/lib/constants";
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
    trackingReason?: string | null;
    sourceSystem?: string | null;
    sourceId?: string | null;
    sourceUrl?: string | null;
    health?: string | null;
    currentSummary?: string | null;
    nextCheckpoint?: string | null;
    reportLevel?: string | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date | null;
  };
  evidenceLabel?: string;
}

export default function WorkItemCard({ item, evidenceLabel }: WorkItemCardProps) {
  const health = item.health || "unknown";
  const reportLevel = item.reportLevel || "none";
  const overdue = isOverdue(item.dueDate, item.status);
  const blocked = item.status === "blocked";
  const closed = item.status === "closed";

  return (
    <Link
      href={`/items/${item.id}`}
      className={`card card-hover entity-card work-item-card priority-${item.priority.toLowerCase()}${blocked ? " is-blocked" : ""}${closed ? " is-closed" : ""}${overdue ? " is-overdue" : ""}`}
    >
      <div className="entity-card-body work-card-heading">
        <div className="entity-card-badges work-card-badges">
          {evidenceLabel && (
            <span className="entity-pill entity-pill--warning">
              {evidenceLabel}
            </span>
          )}
          <span className={`badge badge-${item.priority.toLowerCase()}`}>
            {PRIORITY_LABELS[item.priority] || item.priority}
          </span>
          <span className={`badge badge-${item.status}`}>
            {blocked && <Icon name="alert-triangle" size={11} />}
            {STATUS_LABELS[item.status] || item.status}
          </span>
          {overdue && <span className="badge badge-overdue"><Icon name="clock" size={11} />逾期</span>}
        </div>
        <h3 className="entity-card-title">{item.title}</h3>
        {item.description && <p className="entity-card-summary work-card-description">{item.description}</p>}
      </div>

      {item.currentSummary && (
        <div className="next-action-box">
          <span><Icon name="file-text" size={13} />当前摘要</span>
          <strong>{item.currentSummary}</strong>
        </div>
      )}

      {item.nextAction && (
        <div className="next-action-box">
          <span><Icon name="chevron-right" size={13} />NEXT ACTION</span>
          <strong>{item.nextAction}</strong>
        </div>
      )}

      <div className="entity-card-meta work-card-meta">
        <span>{WORK_ITEM_TYPE_LABELS[item.type] || item.type}</span>
        <span>{HEALTH_LABELS[health] || health}</span>
        {item.nextCheckpoint && <span><Icon name="calendar" size={11} />{item.nextCheckpoint}</span>}
        <span>{REPORT_LEVEL_LABELS[reportLevel] || reportLevel}</span>
        {(item.sourceSystem || item.sourceId) && (
          <span>
            {item.sourceSystem ? (SOURCE_SYSTEM_LABELS[item.sourceSystem] || item.sourceSystem) : "来源"}
            {item.sourceId ? ` / ${item.sourceId}` : ""}
          </span>
        )}
        {item.trackingReason && <span>跟踪：{item.trackingReason}</span>}
        {item.sourceUrl && <span>有来源链接</span>}
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
