"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import {
  HEALTH_LABELS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/constants";
import type { Project } from "@/lib/types";

const HEALTH_TONE: Record<string, string> = {
  green: "success",
  yellow: "warning",
  red: "danger",
  unknown: "neutral",
};

type ProjectHeaderSectionProps = {
  project: Pick<Project, "id" | "name" | "code" | "status" | "stage" | "type" | "health">;
};

export default function ProjectHeaderSection({ project }: ProjectHeaderSectionProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Link href="/projects" style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
              <Icon name="arrow-left" size={14} /> 返回列表
            </Link>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, wordBreak: "break-word" }}>
            {project.name}
            {project.code && <span style={{ fontSize: 14, color: "var(--text-tertiary)", marginLeft: 12 }}>{project.code}</span>}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <span className={`badge badge-${HEALTH_TONE[project.health] || "neutral"}`}>
              {HEALTH_LABELS[project.health] || project.health}
            </span>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </span>
            {project.stage && (
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                {PROJECT_STAGE_LABELS[project.stage] || project.stage}
              </span>
            )}
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              {PROJECT_TYPE_LABELS[project.type] || project.type}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href={`/projects/${project.id}/snapshot`} className="btn btn-ghost">
            <Icon name="file-text" size={15} />
            项目快照事实包
          </Link>
          <Link href={`/projects/${project.id}/edit`} className="btn btn-secondary">
            <Icon name="edit" size={15} />
            编辑项目
          </Link>
        </div>
      </div>
    </section>
  );
}
