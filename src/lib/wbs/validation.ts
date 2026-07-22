import {
  WBS_EXECUTION_STATUSES,
  WBS_NODE_KINDS,
  packageCodeFromTaskCode,
} from "@/lib/wbs/constants";
import type {
  WbsExecutionTransitionInput,
  WbsExecutionTransitionResult,
  WbsTemplateIssue,
  WbsTemplateNode,
} from "@/lib/wbs/types";

function issue(
  code: string,
  message: string,
  node: Pick<WbsTemplateNode, "sheetName" | "rowNumber" | "code">,
): WbsTemplateIssue {
  return {
    severity: "error",
    code,
    message,
    sheetName: node.sheetName,
    rowNumber: node.rowNumber,
    recordCode: node.code,
  };
}

export function validateTemplateStructure(nodes: readonly WbsTemplateNode[]): WbsTemplateIssue[] {
  const issues: WbsTemplateIssue[] = [];
  const keyOwners = new Map<string, WbsTemplateNode>();
  const nodeByKey = new Map<string, WbsTemplateNode>();

  for (const node of nodes) {
    if (!WBS_NODE_KINDS.includes(node.kind)) {
      issues.push(issue("unknown-node-kind", `节点类型无效：${node.kind}`, node));
      continue;
    }

    const key = `${node.stage}|${node.gateKey}|${node.code}`;
    const existing = keyOwners.get(key);
    if (existing) {
      issues.push(
        issue(
          "duplicate-code",
          `模板内重复编号：${node.code}（已在第${existing.rowNumber}行出现）`,
          node,
        ),
      );
    } else {
      keyOwners.set(key, node);
      nodeByKey.set(key, node);
    }

    const segmentCount = node.code.split(".").length;
    if (node.kind === "package" && segmentCount !== 2) {
      issues.push(issue("invalid-package-depth", `工作包编号必须是两段：${node.code}`, node));
    }
    if ((node.kind === "task" || node.kind === "gate") && segmentCount > 3) {
      issues.push(issue("third-level-node", `禁止创建第三层或更深节点：${node.code}`, node));
    }

    if (node.kind === "package" || node.kind === "gate") {
      if (node.parentCode) {
        issues.push(issue("root-node-parent", `${node.kind} 节点不能拥有父节点：${node.parentCode}`, node));
      }
      continue;
    }

    const expectedParentCode = packageCodeFromTaskCode(node.code);
    if (!node.parentCode) {
      issues.push(issue("missing-parent", `执行任务缺少工作包父节点：${node.code}`, node));
      continue;
    }
    if (!expectedParentCode || expectedParentCode !== node.parentCode) {
      issues.push(
        issue(
          "parent-code-mismatch",
          `任务编号 ${node.code} 与当前工作包 ${node.parentCode} 不匹配，期望父节点 ${expectedParentCode ?? "未知"}`,
          node,
        ),
      );
    }

    const parentKey = `${node.stage}|${node.gateKey}|${node.parentCode}`;
    const parent = nodeByKey.get(parentKey);
    if (!parent) {
      issues.push(issue("parent-not-found", `父工作包不存在：${node.parentCode}`, node));
    } else if (parent.kind !== "package") {
      issues.push(issue("invalid-parent-kind", `执行任务只能挂在工作包下：${node.parentCode}`, node));
    }
  }

  for (const gateKey of new Set(nodes.map((node) => node.gateKey))) {
    const gate = nodes.find((node) => node.gateKey === gateKey && node.kind === "gate");
    if (!gate) continue;
    const laterExecutable = nodes.some(
      (node) => node.gateKey === gateKey && node !== gate && node.sortOrder > gate.sortOrder,
    );
    if (laterExecutable) {
      issues.push(issue("review-not-last", `${gateKey} 评审任务必须是该 STR 的最后一条执行任务`, gate));
    }
  }

  return issues;
}

export function validateExecutionTransition(
  input: WbsExecutionTransitionInput,
): WbsExecutionTransitionResult {
  const completionNote = input.completionNote?.trim() || null;
  const blockedReason = input.blockedReason?.trim() || null;
  const waiverReason = input.waiverReason?.trim() || null;
  const errors: string[] = [];

  if (!WBS_EXECUTION_STATUSES.includes(input.nextStatus)) {
    errors.push(`执行状态无效：${input.nextStatus}`);
  }

  if (input.nextStatus === "done" && !completionNote) {
    errors.push("完成任务必须填写完成结论");
  }
  if (input.nextStatus === "done") {
    const requiredDeliverables = input.requiredDeliverables ?? [];
    const pendingRequired = requiredDeliverables.some(
      (deliverable) => deliverable.required && deliverable.status !== "delivered",
    );
    if (pendingRequired) errors.push("必需交付物未全部交付，不能完成任务");
  }
  if (input.nextStatus === "blocked" && !blockedReason) {
    errors.push("阻塞任务必须填写阻塞原因");
  }
  if (input.nextStatus === "waived" && !waiverReason) {
    errors.push("豁免任务必须填写豁免原因");
  }

  const reopening =
    (input.currentStatus === "done" || input.currentStatus === "waived") &&
    (input.nextStatus === "not_started" || input.nextStatus === "in_progress");

  return {
    ok: errors.length === 0,
    errors,
    completionNote,
    blockedReason,
    waiverReason,
    shouldSetCompletedAt: input.nextStatus === "done" && input.currentStatus !== "done",
    shouldClearCompletedAt: reopening,
  };
}
