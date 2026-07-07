"use client";

import type { Project } from "@/lib/types";

type ProjectOverviewSectionProps = {
  project: Pick<
    Project,
    "owner" | "pm" | "startDate" | "targetDate" | "releaseDate" | "currentSummary" | "nextMilestone" | "nextAction"
  >;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function CompactTextBlock({
  label,
  value,
  placeholder,
  strong = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  strong?: boolean;
}) {
  const hasValue = Boolean(value.trim());

  return (
    <div
      style={{
        display: "grid",
        gap: 5,
        padding: "9px 10px",
        borderRadius: 8,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-secondary)",
        minWidth: 0,
      }}
    >
      <div style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 700 }}>{label}</div>
      <div
        style={{
          color: hasValue ? "var(--text-primary)" : "var(--text-tertiary)",
          fontSize: strong ? 14 : 13,
          fontWeight: hasValue && strong ? 650 : 400,
          lineHeight: 1.55,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: label === "当前项目摘要" ? 3 : 2,
          WebkitBoxOrient: "vertical",
          overflowWrap: "anywhere",
        }}
        title={hasValue ? value : ""}
      >
        {hasValue ? value : placeholder}
      </div>
    </div>
  );
}

function CompactMeta({
  label,
  value,
}: {
  label: string;
  value?: string | Date | null;
}) {
  const formattedValue = value instanceof Date || (typeof value === "string" && /^\d{4}-/.test(value))
    ? formatDate(value)
    : value || "—";

  return (
    <div style={{ minWidth: 0, padding: "7px 0" }}>
      <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div style={{ color: formattedValue === "—" ? "var(--text-tertiary)" : "var(--text-primary)", fontSize: 13, fontWeight: formattedValue === "—" ? 400 : 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {formattedValue}
      </div>
    </div>
  );
}

export default function ProjectOverviewSection({ project }: ProjectOverviewSectionProps) {
  const currentSummary = project.currentSummary ?? "";
  const nextMilestone = project.nextMilestone ?? "";
  const nextAction = project.nextAction ?? "";

  return (
    <section className="cockpit-section">
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">OVERVIEW</span>
          <h2>项目概览</h2>
        </div>
      </div>

      <div className="card entity-card entity-card--compact project-overview-card" style={{ padding: 12, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <CompactTextBlock label="当前项目摘要" value={currentSummary} placeholder="—" strong />
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <CompactTextBlock label="下一里程碑" value={nextMilestone} placeholder="—" />
            <CompactTextBlock label="下一步动作" value={nextAction} placeholder="—" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border-secondary)" }}>
          <CompactMeta label="负责人" value={project.owner} />
          <CompactMeta label="PM" value={project.pm} />
          <CompactMeta label="开始日期" value={project.startDate} />
          <CompactMeta label="目标日期" value={project.targetDate} />
          <CompactMeta label="发布日期" value={project.releaseDate} />
        </div>
      </div>
    </section>
  );
}
