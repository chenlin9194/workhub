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

export default function WorkLogCard({ log, showLink = true }: WorkLogCardProps) {
  const reportable = Boolean(log.reportable);
  const typeClass = `log-type-${log.type}`;
  const content = (
    <div className={`card card-hover work-log-card ${typeClass}`}>
      <div className="log-card-topline">
        <span className="log-type-icon"><Icon name={typeIcons[log.type] || "file-text"} size={16} /></span>
        <div className="log-card-heading">
          <div className="log-card-badges">
            <span className={`badge badge-${log.type}`}>{WORK_LOG_TYPE_LABELS[log.type] || log.type}</span>
            <span className="log-date">{log.workDate}</span>
            <span className="log-source">{SOURCE_LABELS[log.source] || log.source}</span>
            {reportable && <span className="badge badge-reportable">可汇报</span>}
            {log.sourceUrl && <span className="badge badge-source">有来源链接</span>}
          </div>
          <h3>{log.title}</h3>
          <p>{log.content}</p>
        </div>
      </div>
      <div className="work-card-meta log-card-meta">
        {log.project && <span>{log.project}</span>}
        {log.module && <span>{log.module}</span>}
        {log.itemId && <span className="linked-item-pill"><Icon name="target" size={11} />关联事项</span>}
        {log.sourceUrl && <span>来源链接</span>}
      </div>
    </div>
  );

  return showLink ? <Link href={`/logs/${log.id}`} className="card-link">{content}</Link> : content;
}
