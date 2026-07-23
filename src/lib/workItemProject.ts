export interface WorkItemProjectUpdateInput {
  currentProjectId?: string | null;
  currentProjectName?: string | null;
  hasProjectId: boolean;
  requestedProjectId: string | null;
  hasProject: boolean;
  requestedProjectName: string | null;
  resolvedProjectName?: string | null;
}

export interface WorkItemProjectUpdate {
  projectId?: string | null;
  project?: string | null;
}

export function resolveWorkItemProjectUpdate({
  currentProjectId,
  currentProjectName,
  hasProjectId,
  requestedProjectId,
  hasProject,
  requestedProjectName,
  resolvedProjectName,
}: WorkItemProjectUpdateInput): WorkItemProjectUpdate {
  if (hasProjectId) {
    if (requestedProjectId) {
      return { projectId: requestedProjectId, project: resolvedProjectName || null };
    }

    return {
      projectId: null,
      project: hasProject ? requestedProjectName : null,
    };
  }

  if (currentProjectId) {
    return { project: currentProjectName || null };
  }

  return hasProject ? { project: requestedProjectName } : {};
}
