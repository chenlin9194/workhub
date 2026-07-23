export function getOptionalProjectDisplayName({
  relationName,
  legacyName,
}: {
  relationName?: string | null;
  legacyName?: string | null;
}) {
  return relationName?.trim() || legacyName?.trim() || null;
}

export function getProjectDisplayName({
  relationName,
  legacyName,
}: {
  relationName?: string | null;
  legacyName?: string | null;
}) {
  return getOptionalProjectDisplayName({ relationName, legacyName }) || "未关联项目";
}
