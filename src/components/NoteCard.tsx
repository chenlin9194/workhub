"use client";

import Link from "next/link";
import { TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { Note } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function NoteCard({ note }: { note: Note }) {
  return (
    <Link href={`/notes/${note.id}`} className="card card-hover" style={{ display: "block", padding: 16, textDecoration: "none" }}>
      {/* Header: title + badges */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {note.title}
        </h3>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <span className={`badge badge-${note.priority.toLowerCase()}`}>{note.priority}</span>
          <span className={`badge badge-${note.status}`}>{STATUS_LABELS[note.status] || note.status}</span>
        </div>
      </div>

      {/* Type + project tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        <span className={`badge badge-${note.type}`} style={{ fontSize: 11 }}>
          {TYPE_LABELS[note.type] || note.type}
        </span>
        {note.project && (
          <span style={{
            display: "inline-flex", padding: "2px 8px", borderRadius: 999,
            fontSize: 11, background: "var(--bg-tertiary)", color: "var(--text-secondary)",
          }}>
            {note.project}
          </span>
        )}
        {note.module && (
          <span style={{
            display: "inline-flex", padding: "2px 8px", borderRadius: 999,
            fontSize: 11, background: "var(--bg-tertiary)", color: "var(--text-secondary)",
          }}>
            {note.module}
          </span>
        )}
      </div>

      {/* Footer: owner + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {note.owner && <span>@{note.owner}</span>}
          {note.dueDate && <span>DDL {note.dueDate}</span>}
        </div>
        <span>{formatDate(note.createdAt)}</span>
      </div>

      {/* Tags */}
      {note.tags && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {note.tags.split(",").map((tag, i) => (
            <span key={i} style={{
              display: "inline-flex", padding: "1px 6px", borderRadius: 4,
              fontSize: 11, background: "var(--accent-blue-light)", color: "var(--accent-blue)",
            }}>
              #{tag.trim()}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
