export interface AdvancedItemFilterValues {
  type?: string;
  priority?: string;
  status?: string;
  health?: string;
  reportLevel?: string;
  sourceSystem?: string;
  module?: string;
  owner?: string;
  overdue?: boolean;
  quality?: string;
}

export function hasAdvancedItemFilters(filters: AdvancedItemFilterValues) {
  return Boolean(
    filters.type ||
      filters.priority ||
      filters.status ||
      filters.health ||
      filters.reportLevel ||
      filters.sourceSystem ||
      filters.module ||
      filters.owner ||
      filters.overdue ||
      filters.quality
  );
}
