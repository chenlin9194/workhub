import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/constants";
import { getTodayRange, formatTodayStr, groupNotes } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { start, end } = getTodayRange();

  const notes = await prisma.note.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
  });

  const groups = groupNotes(notes);
  const completed = notes.filter((n) => n.status === "closed");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>今日记录汇总</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>{formatTodayStr()}</p>
        </div>
        <Link href="/ai" className="btn btn-purple">AI 生成日报</Link>
      </div>

      {/* Stats bar */}
      <div className="card" style={{ padding: "12px 16px", display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
        <span style={{ color: "var(--text-tertiary)" }}>今日共 <strong style={{ color: "var(--text-primary)" }}>{notes.length}</strong> 条</span>
        <span style={{ color: "var(--text-tertiary)" }}>完成 <strong style={{ color: "var(--accent-green)" }}>{completed.length}</strong></span>
        <span style={{ color: "var(--text-tertiary)" }}>
          待处理 <strong style={{ color: "var(--accent-orange)" }}>{notes.filter((n) => n.status === "open").length}</strong>
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          跟进中 <strong style={{ color: "var(--accent-blue)" }}>{notes.filter((n) => n.status === "following").length}</strong>
        </span>
      </div>

      {notes.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📅</div>
          今日暂无记录
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((group) => (
            <div key={group.title} className="card" style={{ overflow: "hidden" }}>
              <div className="section-header">
                <span>{group.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)", fontWeight: 400 }}>
                  {group.items.length} 条
                </span>
              </div>
              <div>
                {group.items.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="today-row"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border-primary)",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span className={`badge badge-${note.priority.toLowerCase()}`} style={{ fontSize: 10 }}>{note.priority}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {note.title}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {note.content}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {note.project && (
                        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                          {note.project}
                        </span>
                      )}
                      <span className={`badge badge-${note.status}`} style={{ fontSize: 11 }}>
                        {STATUS_LABELS[note.status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
