export interface ProjectSelectionOption {
  id: string;
  name: string;
}

export function resolveProjectSelection(
  projectId: string,
  projects: ProjectSelectionOption[]
) {
  const project = projects.find((candidate) => candidate.id === projectId);
  return {
    projectId: project?.id || "",
    project: project?.name || "",
  };
}
