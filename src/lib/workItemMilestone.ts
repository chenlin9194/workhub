export type MilestoneProjectRef = { projectId: string } | null | undefined;

export function validateWorkItemMilestone(
  projectId: string | null | undefined,
  milestoneId: string | null | undefined,
  milestone: MilestoneProjectRef,
) {
  if (!milestoneId) return null;
  if (!projectId) return "关联 STR 前必须先选择项目";
  if (!milestone || milestone.projectId !== projectId) return "事项只能关联所属项目的 STR";
  return null;
}

export function resolveMilestoneOnProjectChange({
  projectId,
  milestoneId,
  milestoneProjectId,
}: {
  projectId: string | null | undefined;
  milestoneId: string | null | undefined;
  milestoneProjectId?: string | null;
}) {
  return validateWorkItemMilestone(projectId, milestoneId, milestoneProjectId ? { projectId: milestoneProjectId } : null)
    ? null
    : milestoneId || null;
}
