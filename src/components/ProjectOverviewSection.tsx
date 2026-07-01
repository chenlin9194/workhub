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
  const currentSummary = project.currentSummary ?? "";
  const nextMilestone = project.nextMilestone ?? "";
  const nextAction = project.nextAction ?? "";
  const hasCurrentSummary = Boolean(currentSummary.trim());
  const hasNextMilestone = Boolean(nextMilestone.trim());
  const hasNextAction = Boolean(nextAction.trim());
  const overviewFieldsEmpty = !hasCurrentSummary && !hasNextMilestone && !hasNextAction;

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

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
          {overviewFieldsEmpty ? (
            <div style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              可补充当前摘要、下一里程碑和下一动作，方便后续生成项目快照事实包。
            </div>
          ) : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>当前摘要</div>
                <div style={{ fontSize: 14, color: hasCurrentSummary ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {hasCurrentSummary ? currentSummary : "可补充当前摘要，便于快速了解项目现状。"}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一里程碑</div>
                <div style={{ fontSize: 14, color: hasNextMilestone ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {hasNextMilestone ? nextMilestone : "可补充下一里程碑，便于判断项目节奏。"}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一步行动</div>
                <div style={{ fontSize: 14, color: hasNextAction ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {hasNextAction ? nextAction : "可补充下一步行动，便于明确近期推进。"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
