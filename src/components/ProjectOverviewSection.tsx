"use client";

import type { Project } from "@/lib/types";

type ProjectOverviewSectionProps = {
  project: Pick<
    Project,
    "owner" | "pm" | "startDate" | "targetDate" | "releaseDate" | "currentSummary" | "nextMilestone" | "nextAction"
  >;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function ProjectOverviewSection({ project }: ProjectOverviewSectionProps) {
  const currentSummary = project.currentSummary || "建议补充当前摘要";
  const nextMilestone = project.nextMilestone || "建议补充下一里程碑";
  const nextAction = project.nextAction || "建议补充下一动作";

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">OVERVIEW</span>
          <h2>项目概览</h2>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {project.owner && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>负责人</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.owner}</div>
            </div>
          )}
          {project.pm && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>PM</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{project.pm}</div>
            </div>
          )}
          {project.startDate && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>开始日期</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatDate(project.startDate)}</div>
            </div>
          )}
          {project.targetDate && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>目标日期</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatDate(project.targetDate)}</div>
            </div>
          )}
          {project.releaseDate && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>发布日期</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatDate(project.releaseDate)}</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-primary)", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>当前摘要</div>
            <div style={{ fontSize: 14, color: project.currentSummary ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {currentSummary}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一里程碑</div>
            <div style={{ fontSize: 14, color: project.nextMilestone ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {nextMilestone}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一步行动</div>
            <div style={{ fontSize: 14, color: project.nextAction ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {nextAction}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
