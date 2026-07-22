"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = { projectId: string; originWbsNodeId?: string | null; executionMilestoneId?: string | null };

export default function WbsExecutionSummary({ projectId, originWbsNodeId, executionMilestoneId }: Props) {
  const [node, setNode] = useState<{ id: string; gateKey: string; code: string; title: string; role: string | null; status: string | null; completionNote: string | null; milestone: { title: string; targetDate: string | null } } | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(`/api/projects/${projectId}/wbs`).then((response) => response.ok ? response.json() : null).then((data) => {
      const next = data?.plan?.nodes?.find((candidate: { id: string; milestoneId?: string }) => candidate.id === originWbsNodeId || candidate.milestoneId === executionMilestoneId);
      if (active) setNode(next || null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [executionMilestoneId, originWbsNodeId, projectId]);

  if (!node) return null;
  return <section className="card wbs-item-summary"><div className="detail-section-heading"><div><span className="wbs-eyebrow">WBS EXECUTION</span><h2>WBS 执行摘要</h2></div><Link href={`/projects/${projectId}/wbs/${node.gateKey}`} className="section-link">进入 {node.gateKey}</Link></div><div className="wbs-item-summary-grid"><div><span>节点</span><strong>{node.code} · {node.title}</strong></div><div><span>WBS 角色</span><strong>{node.role || "未设置"}</strong></div><div><span>状态</span><strong>{node.status || "工作包自动计算"}</strong></div><div><span>STR 里程碑</span><strong>{node.milestone.title} · {node.milestone.targetDate || "未设置日期"}</strong></div></div>{node.completionNote && <p>{node.completionNote}</p>}</section>;
}
