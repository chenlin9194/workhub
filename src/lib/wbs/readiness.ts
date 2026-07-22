import {
  WBS_EXECUTION_STATUSES,
  WBS_GATE_RULES,
} from "@/lib/wbs/constants";
import type { WbsExecutionStatus, WbsGateKey } from "@/lib/wbs/constants";
import type {
  WbsExecutionNodeState,
  WbsReadinessSummary,
} from "@/lib/wbs/types";

function isClosed(status: WbsExecutionStatus | null): boolean {
  return status === "done" || status === "waived";
}

function executableNodes(nodes: readonly WbsExecutionNodeState[]): WbsExecutionNodeState[] {
  return nodes.filter((node) => node.kind === "task" || node.kind === "gate");
}

export function derivePackageStatus(children: readonly WbsExecutionNodeState[]): WbsExecutionStatus {
  const executable = executableNodes(children);
  if (executable.some((node) => node.status === "blocked")) return "blocked";
  if (executable.length > 0 && executable.every((node) => isClosed(node.status))) return "done";
  if (executable.some((node) => node.status === "in_progress" || isClosed(node.status))) {
    return "in_progress";
  }
  return "not_started";
}

export function deriveStrStatus(nodes: readonly WbsExecutionNodeState[]): WbsReadinessSummary["status"] {
  const executable = executableNodes(nodes);
  if (executable.length === 0 || executable.every((node) => node.status === "not_started")) return "open";
  if (executable.some((node) => node.status === "blocked")) return "blocked";
  if (executable.every((node) => isClosed(node.status))) return "closed";
  return "in_progress";
}

export function deriveMilestoneStatus(
  nodes: readonly WbsExecutionNodeState[],
  targetDate: string | null,
  today: string,
): "not_started" | "in_progress" | "delayed" | "done" {
  const executable = executableNodes(nodes);
  if (executable.length > 0 && executable.every((node) => isClosed(node.status))) return "done";
  if (targetDate && targetDate < today) return "delayed";
  if (executable.some((node) => node.status !== "not_started" && node.status !== null)) return "in_progress";
  return "not_started";
}

export function deriveStrReadiness(
  gateKey: WbsGateKey,
  nodes: readonly WbsExecutionNodeState[],
): WbsReadinessSummary {
  const executable = executableNodes(nodes);
  const completedExecutionNodes = executable.filter((node) => isClosed(node.status)).length;
  const blockedNodes = executable.filter((node) => node.status === "blocked").length;
  const pendingRequiredDeliverables = executable.reduce(
    (total, node) =>
      total +
      (node.requiredDeliverables ?? []).filter(
        (deliverable) => deliverable.required && deliverable.status !== "delivered",
      ).length,
    0,
  );
  const completionPercent = executable.length
    ? Math.round((completedExecutionNodes / executable.length) * 100)
    : 0;
  const reviewIndex = WBS_GATE_RULES.findIndex((rule) => rule.gateKey === gateKey);
  const reviewNode = executable.find((node) => node.kind === "gate");
  const preceding = reviewNode ? executable.filter((node) => node !== reviewNode) : executable;
  const precedingClosed = preceding.length > 0 && preceding.every((node) => isClosed(node.status));
  const nextAction =
    reviewNode && precedingClosed && !isClosed(reviewNode.status)
      ? "组织 STR 评审"
      : reviewIndex >= 0 && blockedNodes > 0
        ? "处理阻塞任务"
        : null;

  return {
    status: deriveStrStatus(executable),
    totalExecutionNodes: executable.length,
    completedExecutionNodes,
    blockedNodes,
    pendingRequiredDeliverables,
    completionPercent,
    nextAction,
  };
}

export function isExecutionStatus(value: unknown): value is WbsExecutionStatus {
  return typeof value === "string" && WBS_EXECUTION_STATUSES.includes(value as WbsExecutionStatus);
}
