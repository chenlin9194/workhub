import { buildItemsLink, buildLogsLink } from "@/lib/filterLinks";

type ItemHrefSignal = "open" | "following" | "blocked" | "p0" | "p1" | "p0p1" | "overdue" | "redYellow" | "projectItems";
type LogHrefSignal = "todayLogs" | "decision" | "risk" | "blocker" | "reportable" | "projectLogs";

type ItemFilter = Parameters<typeof buildItemsLink>[0];
type LogFilter = Parameters<typeof buildLogsLink>[0];

export const signalToItemsFilter = (signal: ItemHrefSignal, projectId?: string): ItemFilter | undefined => {
  switch (signal) {
    case "open":
      return { projectId, status: "open" };
    case "following":
      return { projectId, status: "following" };
    case "blocked":
      return { projectId, status: "blocked" };
    case "p0":
      return { projectId, priority: "P0" };
    case "p1":
      return { projectId, priority: "P1" };
    case "p0p1":
      return { projectId, priority: ["P0", "P1"] };
    case "overdue":
      return { projectId, overdue: true };
    case "redYellow":
    case "projectItems":
      return { projectId };
    default:
      return undefined;
  }
};

export const signalToLogsFilter = (signal: LogHrefSignal, projectId?: string, today?: string): LogFilter | undefined => {
  switch (signal) {
    case "todayLogs":
      return today ? { startDate: today, endDate: today } : undefined;
    case "decision":
      return today ? { startDate: today, endDate: today, type: "decision" } : undefined;
    case "risk":
      return { projectId, type: "risk" };
    case "blocker":
      return { projectId, type: "blocker" };
    case "reportable":
      return { projectId, reportable: true };
    case "projectLogs":
      return { projectId };
    default:
      return undefined;
  }
};

export const signalToItemsHref = (signal: ItemHrefSignal, projectId?: string) => {
  const filter = signalToItemsFilter(signal, projectId);
  return filter ? buildItemsLink(filter) : "/items";
};

export const signalToLogsHref = (signal: LogHrefSignal, projectId?: string, today?: string) => {
  const filter = signalToLogsFilter(signal, projectId, today);
  return filter ? buildLogsLink(filter) : "/logs";
};

export const itemToAddLogHref = (itemId: string, projectId?: string) => {
  return buildLogsLink({ itemId, projectId });
};

export const itemToLogsHref = (itemId: string) => {
  return buildLogsLink({ itemId });
};
