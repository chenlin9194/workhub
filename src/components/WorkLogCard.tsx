"use client";

import Link from "next/link";
import { WORK_LOG_TYPE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import Icon from "./Icon";

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
    reportable?: boolean | null;
    sourceUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  showLink?: boolean;
  evidenceLabel?: string;
}

const typeIcons: Record<string, string> = {
  note: "file-text",
  meeting: "users",
  update: "refresh",
  risk: "alert-triangle",
  decision: "lightbulb",
  todo: "clipboard-list",
  feishu: "message-square",
  issue: "search",
  blocker: "shield-off",
  other: "flag",
};

const highValueTypes = new Set(["risk", "blocker", "decision", "issue"]);

export default function WorkLogCard({ log, showLink = true, evidenceLabel }: WorkLogCardProps) {
  const reportable = Boolean(log.reportable);
  const isSystemUpdate = log.type === "update" && log.title.startsWith("事项变化：");
  const isHighValue = !isSystemUpdate && (reportable || highValueTypes.has(log.type));
  const typeClass = `log-type-${log.type}${isSystemUpdate ? " is-system-update" : ""}${isHighValue ? " is-high-value" : ""}`;
  const content = (
    <div
      className={`card card-hover entity-card work-log-card ${typeClass}`}
      style={isSystemUpdate ? { opacity: 0.78 } : undefined}
    >
      <div className="log-card-topline entity-card-header">
        <span className="log-type-icon"><Icon name={typeIcons[log.type] || "file-text"} size={16} /></span>
        <div className="log-card-heading entity-card-body">
          <div className="log-card-badges entity-card-badges">
            {evidenceLabel && (
              <span className="entity-pill entity-pill--blue">
                {evidenceLabel}
              </span>
            )}
            {isHighValue && !evidenceLabel && (
              <span className="entity-pill entity-pill--blue">
                关键事实
              </span>
            )}
            {isSystemUpdate && (
              <span className="entity-pill entity-pill--muted">
                系统动态
              </span>
            )}
            <span className={`badge badge-${log.type}`}>{WORK_LOG_TYPE_LABELS[log.type] || log.type}</span>
            <span className="log-date">{log.workDate}</span>
            <span className="log-source">{SOURCE_LABELS[log.source] || log.source}</span>
            {reportable && <span className="badge badge-reportable">可汇报</span>}
            {log.sourceUrl && <span className="badge badge-source">有来源链接</span>}
          </div>
          <h3 className="entity-card-title">{log.title}</h3>
          <p className="entity-card-summary">{log.content}</p>
        </div>
      </div>
      <div className="entity-card-meta log-card-meta">
        {log.project && <span>{log.project}</span>}
        {log.module && <span>{log.module}</span>}
        {log.itemId && <span className="entity-pill entity-pill--cyan"><Icon name="target" size={11} />关联事项</span>}
      </div>
    </div>
  );

  return showLink ? <Link href={`/logs/${log.id}`} className="card-link">{content}</Link> : content;
}
