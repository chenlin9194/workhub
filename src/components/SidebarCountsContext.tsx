"use client";

import { createContext, useContext } from "react";

export type SidebarCounts = {
  openItems: number;
  unarchivedFacts: number;
  openActionItems: number;
};

const SidebarCountsContext = createContext<SidebarCounts>({
  openItems: 0,
  unarchivedFacts: 0,
  openActionItems: 0,
});

export function SidebarCountsProvider({
  counts,
  children,
}: {
  counts: SidebarCounts;
  children: React.ReactNode;
}) {
  return <SidebarCountsContext.Provider value={counts}>{children}</SidebarCountsContext.Provider>;
}

export function useSidebarCounts() {
  return useContext(SidebarCountsContext);
}
