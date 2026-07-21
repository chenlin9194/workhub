"use client";

import { useRouter } from "next/navigation";
import { HEALTH_LABELS, PRIORITY_LABELS, REPORT_LEVEL_LABELS, STATUS_LABELS } from "@/lib/constants";
import { isOverdue } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  project?: string | null;
  priority: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  health: string;
  reportLevel: string;
  sourceId?: string | null;
  updatedAt: Date;
};

function relativeUpdate(value: Date) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3600000));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}h 前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export default function ItemsTable({ items }: { items: Array<{ item: Item; lowActivity: boolean }> }) {
  const router = useRouter();

  return (
    <div className="redesign-items-table-wrap">
      <table className="redesign-items-table">
        <thead>
          <tr>
            <th>ID</th><th aria-label="健康度" /><th>优先</th><th>状态</th><th>标题</th><th>项目</th><th>责任人</th><th>到期</th><th>汇报</th><th>更新</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ item, lowActivity }) => {
            const overdue = isOverdue(item.dueDate, item.status);
            return (
              <tr key={item.id} onClick={() => router.push(`/items/${item.id}`)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && router.push(`/items/${item.id}`)}>
                <td className="redesign-item-id">{item.sourceId || `WI-${item.id.slice(-6).toUpperCase()}`}</td>
                <td><i className={`redesign-health-dot is-${item.health}`} title={HEALTH_LABELS[item.health] || item.health} /></td>
                <td><span className={`redesign-table-badge is-${item.priority.toLowerCase()}`}>{PRIORITY_LABELS[item.priority] || item.priority}</span></td>
                <td><span className={`redesign-table-badge is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span></td>
                <td className="redesign-item-title">{item.title}{lowActivity && <small>低活跃</small>}</td>
                <td><span className="redesign-item-project">{item.project || "—"}</span></td>
                <td>{item.owner || "—"}</td>
                <td className={overdue ? "is-overdue" : ""}>{item.dueDate || "—"}</td>
                <td>{item.reportLevel === "none" ? "—" : REPORT_LEVEL_LABELS[item.reportLevel] || item.reportLevel}</td>
                <td>{relativeUpdate(item.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
