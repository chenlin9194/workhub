"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { ACTION_ITEM_STATUS_LABELS } from "@/lib/constants";
import { groupOpenActionItems } from "@/lib/actionItemQueue";

export type TodayAction = {
  id: string;
  title: string;
  status: string;
  owner?: string | null;
  dueDate?: string | null;
  workItemId?: string | null;
  workLogId?: string | null;
  workItem?: { id: string; title: string; milestone?: { title: string; gateKey?: string | null } | null } | null;
  workLog?: { id: string; title: string } | null;
  project?: { id: string; name: string; code?: string | null } | null;
};

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

export default function TodayActionQueue({ initialItems, today }: { initialItems: TodayAction[]; today: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [doneNotes, setDoneNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const groups = useMemo(() => groupOpenActionItems(items, today), [items, today]);

  const updateStatus = async (item: TodayAction, status: string, doneNote?: string) => {
    if (busyId) return;
    setBusyId(item.id);
    setNotice(null);

    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(doneNote !== undefined ? { doneNote } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice(getErrorMessage(body, "行动项更新失败，请稍后重试。"));
        return;
      }

      if (status === "done") {
        setItems((current) => current.filter((candidate) => candidate.id !== item.id));
        setCompletionId(null);
        setNotice("已记录处理结论，行动项已完成。");
      } else {
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status } : candidate));
        setNotice("行动项状态已更新。");
      }
      router.refresh();
    } catch (error) {
      console.error("Error updating today action item:", error);
      setNotice("行动项更新失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  };

  const renderAction = (item: TodayAction) => {
    const busy = busyId === item.id;
    const isOverdue = Boolean(item.dueDate && item.dueDate < today);
    const contextHref = item.workItemId
      ? `/items/${item.workItemId}`
      : item.workLogId
        ? `/logs/${item.workLogId}`
        : null;
    const contextTitle = item.workItem?.title || item.workLog?.title;
    const isCompleting = completionId === item.id;

    return (
      <div key={item.id} className={`today-action-item ${isOverdue ? "today-action-item--overdue" : ""}`}>
        <div className="today-action-item-main">
          <div className="today-action-item-title">{item.title}</div>
          <div className="today-action-item-meta">
            <span>{ACTION_ITEM_STATUS_LABELS[item.status] || item.status}</span>
            {item.owner && <span>负责人：{item.owner}</span>}
            {item.dueDate && <span>{isOverdue ? "已逾期" : item.dueDate === today ? "今日截止" : "截止"}：{item.dueDate}</span>}
            {item.project && <span>项目：{item.project.code || item.project.name}</span>}
            {item.workItem?.milestone && <span>STR：{item.workItem.milestone.gateKey ? `${item.workItem.milestone.gateKey} · ` : ""}{item.workItem.milestone.title}</span>}
            {contextTitle && <span>来源：{contextTitle}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {item.status !== "in_progress" && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => void updateStatus(item, "in_progress")}>
              处理中
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 12 }}
            disabled={busy}
            onClick={() => setCompletionId((current) => current === item.id ? null : item.id)}
          >
            已处理
          </button>
          {contextHref && (
            <Link href={contextHref} className="section-link">
              查看上下文 <Icon name="chevron-right" size={13} />
            </Link>
          )}
        </div>
        {isCompleting && (
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8, marginTop: 4 }}>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 650 }} htmlFor={`action-done-note-${item.id}`}>
              处理结论 <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              id={`action-done-note-${item.id}`}
              value={doneNotes[item.id] || ""}
              onChange={(event) => setDoneNotes((current) => ({ ...current, [item.id]: event.target.value }))}
              rows={3}
              placeholder="记录处理结果、同步结论或后续决定"
              disabled={busy}
              style={{ width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => setCompletionId(null)}>取消</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 12 }}
                disabled={busy || !(doneNotes[item.id] || "").trim()}
                onClick={() => void updateStatus(item, "done", doneNotes[item.id])}
              >
                {busy ? "保存中..." : "保存结论并完成"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const sections = [
    { key: "overdue", title: "已逾期", items: groups.overdue },
    { key: "dueToday", title: "今日到期", items: groups.dueToday },
    { key: "upcoming", title: "即将到期 / 未设置日期", items: groups.upcoming },
  ];

  return (
    <section className="card cockpit-card today-group-card today-action-items-card">
      <div className="cockpit-card-head">
        <div>
          <span className="section-eyebrow">ACTION ITEMS</span>
          <h2>今日行动项</h2>
        </div>
        <span className="section-count">完成时必须记录处理结论，确保后续汇报可追溯。</span>
      </div>
      {notice && <div className="action-item-notice">{notice}</div>}
      {items.length === 0 ? (
        <div className="today-compact-empty"><span />当前没有未处理行动项。</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {sections.filter((section) => section.items.length > 0).map((section) => (
            <div key={section.key} style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 750, color: section.key === "overdue" ? "var(--danger)" : "var(--text-secondary)" }}>
                {section.title}（{section.items.length}）
              </div>
              <div className="today-action-item-list">{section.items.map(renderAction)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
