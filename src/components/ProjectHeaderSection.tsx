"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  unknown: "muted",
};

const HEALTH_HEADLINE: Record<string, string> = {
  green: "状态正常",
  yellow: "需要关注",
  red: "存在风险",
  unknown: "状态待确认",
};

type ProjectHeaderSectionProps = {
  project: Pick<Project, "id" | "name" | "code" | "status" | "stage" | "type" | "health">;
};

export default function ProjectHeaderSection({ project }: ProjectHeaderSectionProps) {
  const router = useRouter();
  const actionInFlightRef = useRef(false);
  const [deleting, setDeleting] = useState(false);

  const healthTone = HEALTH_TONE[project.health] || "muted";
  const healthLabel = HEALTH_LABELS[project.health] || project.health;
  const statusLabel = PROJECT_STATUS_LABELS[project.status] || project.status;
  const stageLabel = project.stage ? PROJECT_STAGE_LABELS[project.stage] || project.stage : "阶段待确认";
  const typeLabel = PROJECT_TYPE_LABELS[project.type] || project.type;

  const readErrorMessage = async (res: Response) => {
    const text = await res.text();
    if (!text) return "删除失败";

    try {
      const data = JSON.parse(text) as { error?: string };
      return data.error || "删除失败";
    } catch {
      return "删除失败";
    }
  };

  const handleDelete = async () => {
    if (actionInFlightRef.current) return;

    const confirmed = window.confirm("确认删除这个项目？关联事项和日志不会被删除，只会解除项目关联。");
    if (!confirmed) return;

    actionInFlightRef.current = true;
    setDeleting(true);
    let shouldRestoreButton = true;

    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });

      if (res.ok) {
        shouldRestoreButton = false;
        router.replace("/projects");
        return;
      }

      alert(await readErrorMessage(res));
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("删除失败");
    } finally {
      if (shouldRestoreButton) {
        actionInFlightRef.current = false;
        setDeleting(false);
      }
    }
  };

  return (
    <section className="cockpit-section">
      <div className="card cockpit-header">
        <div className="cockpit-header-top">
          <div className="cockpit-header-title">
            <Link href="/projects" className="cockpit-header-back">
              <Icon name="arrow-left" size={14} /> 返回列表
            </Link>

            <div className="cockpit-header-name-row">
              <h1 className="cockpit-header-name">{project.name}</h1>
              {project.code && <span className="cockpit-header-code">{project.code}</span>}
            </div>

            <div className="cockpit-header-status">
              <strong style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>
                {HEALTH_HEADLINE[project.health] || healthLabel}
              </strong>
              <span className={`entity-pill entity-pill--${healthTone}`}>健康：{healthLabel}</span>
              <span className="entity-pill entity-pill--muted">状态：{statusLabel}</span>
              <span className="entity-pill entity-pill--muted">阶段：{stageLabel}</span>
              <span className="entity-pill entity-pill--muted">类型：{typeLabel}</span>
            </div>
          </div>

          <div className="cockpit-header-actions">
            <Link href={`/projects/${project.id}/snapshot`} className="btn btn-ghost">
              <Icon name="file-text" size={15} />
              项目快照事实包
            </Link>
            <Link href={`/projects/${project.id}/edit`} className="btn btn-secondary">
              <Icon name="edit" size={15} />
              编辑项目
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-danger"
              disabled={deleting}
            >
              {deleting ? (
                "删除中..."
              ) : (
                <>
                  <Icon name="trash" size={15} />
                  删除项目
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
