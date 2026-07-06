type ItemQuery = {
  projectId?: string;
  project?: string;
  module?: string;
  type?: string;
  visibility?: string;
  priority?: string | string[];
  status?: string;
  owner?: string;
  health?: string;
  reportLevel?: string;
  sourceSystem?: string;
  keyword?: string;
  overdue?: boolean;
};

type LogQuery = {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  project?: string;
  itemId?: string;
  module?: string;
  type?: string;
  source?: string;
  hasItem?: string;
  reportable?: string | boolean;
  view?: string;
  keyword?: string;
};

type Pagination = {
  page?: number;
  pageSize?: number;
};

type ProjectQuery = {
  keyword?: string;
  status?: string;
  health?: string;
  stage?: string;
};

function appendString(params: URLSearchParams, key: string, value?: string) {
  if (value) params.set(key, value);
}

function appendBoolean(params: URLSearchParams, key: string, value?: boolean) {
  if (value) params.set(key, "true");
}

function appendPriority(params: URLSearchParams, value?: string | string[]) {
  if (!value) return;
  params.set("priority", Array.isArray(value) ? value.join(",") : value);
}

function appendPagination(params: URLSearchParams, pagination?: Pagination) {
  if (pagination?.page) params.set("page", String(pagination.page));
  if (pagination?.pageSize) params.set("pageSize", String(pagination.pageSize));
}

export function buildItemsQueryString(filters: ItemQuery, pagination?: Pagination) {
  const params = new URLSearchParams();

  appendString(params, "projectId", filters.projectId);
  if (!filters.projectId) appendString(params, "project", filters.project);
  appendString(params, "module", filters.module);
  appendString(params, "type", filters.type);
  appendString(params, "visibility", filters.visibility);
  appendPriority(params, filters.priority);
  appendString(params, "status", filters.status);
  appendString(params, "owner", filters.owner);
  appendString(params, "health", filters.health);
  appendString(params, "reportLevel", filters.reportLevel);
  appendString(params, "sourceSystem", filters.sourceSystem);
  appendString(params, "keyword", filters.keyword);
  appendBoolean(params, "overdue", filters.overdue);
  appendPagination(params, pagination);

  return params.toString();
}

export function buildItemsLink(filters: ItemQuery) {
  const query = buildItemsQueryString(filters);
  return query ? `/items?${query}` : "/items";
}

export function buildProjectItemsLink(projectId: string) {
  return buildItemsLink({ projectId });
}

export function buildLogsQueryString(filters: LogQuery, pagination?: Pagination) {
  const params = new URLSearchParams();

  appendString(params, "startDate", filters.startDate);
  appendString(params, "endDate", filters.endDate);
  appendString(params, "projectId", filters.projectId);
  if (!filters.projectId) appendString(params, "project", filters.project);
  appendString(params, "itemId", filters.itemId);
  appendString(params, "module", filters.module);
  appendString(params, "type", filters.type);
  appendString(params, "source", filters.source);
  appendString(params, "hasItem", filters.hasItem);
  if (typeof filters.reportable === "boolean") appendBoolean(params, "reportable", filters.reportable);
  else appendString(params, "reportable", filters.reportable);
  appendString(params, "view", filters.view);
  appendString(params, "keyword", filters.keyword);
  appendPagination(params, pagination);

  return params.toString();
}

export function buildLogsLink(filters: LogQuery) {
  const query = buildLogsQueryString(filters);
  return query ? `/logs?${query}` : "/logs";
}

export function buildLogsRiskLink(projectId?: string) {
  return buildLogsLink({ projectId, type: "risk", reportable: true });
}

export function buildProjectLogsLink(projectId: string) {
  return buildLogsLink({ projectId });
}

export function buildProjectsQueryString(filters: ProjectQuery, pagination?: Pagination) {
  const params = new URLSearchParams();

  appendString(params, "keyword", filters.keyword);
  appendString(params, "status", filters.status);
  appendString(params, "health", filters.health);
  appendString(params, "stage", filters.stage);
  appendPagination(params, pagination);

  return params.toString();
}
