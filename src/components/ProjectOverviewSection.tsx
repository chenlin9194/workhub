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
  const hasMeta = Boolean(project.owner || project.pm || project.startDate || project.targetDate || project.releaseDate);

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">OVERVIEW</span>
          <h2>项目概览</h2>
        </div>
      </div>

      <div className="card entity-card entity-card--compact" style={{ padding: 20 }}>
        {overviewFieldsEmpty ? (
          <div style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            可补充当前摘要、下一里程碑和下一步动作，方便打开项目时快速判断现状。
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 16 }}>
            <div style={{ minWidth: 0, paddingRight: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>当前项目摘要</div>
              <div
                style={{
                  fontSize: 15,
                  color: hasCurrentSummary ? "var(--text-primary)" : "var(--text-tertiary)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {hasCurrentSummary ? currentSummary : "可补充当前摘要，便于快速了解项目现状。"}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>下一步动作</div>
                <div style={{ fontSize: 14, fontWeight: hasNextAction ? 650 : 400, color: hasNextAction ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {hasNextAction ? nextAction : "可补充下一步动作，便于明确近期推进。"}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>下一里程碑</div>
                <div style={{ fontSize: 14, color: hasNextMilestone ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {hasNextMilestone ? nextMilestone : "可补充下一里程碑，便于判断项目节奏。"}
                </div>
              </div>
            </div>
          </div>
        )}

        {hasMeta && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-primary)" }}>
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
        )}
      </div>
    </section>
  );
}
