"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useSidebarCounts } from "./SidebarCountsContext";

const mainItems = [
  { href: "/", label: "工作台", icon: "home", exact: true },
  { href: "/projects", label: "项目", icon: "folder" },
  { href: "/items", label: "事项", icon: "list", count: "openItems" as const },
  { href: "/reports", label: "汇报", icon: "chart", exact: true },
];

const inboxItems = [
  { href: "/logs?hasItem=false&view=all", label: "未归档事实", icon: "inbox", count: "unarchivedFacts" as const },
  { href: "/today", label: "今日行动项", icon: "zap", count: "openActionItems" as const },
];

const toolItems = [
  { href: "/stats", label: "统计概览", icon: "activity" },
  { href: "/export/today", label: "导出", icon: "download" },
  { href: "/settings/tools", label: "工具入口", icon: "settings" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

export default function SidebarNavigation() {
  const pathname = usePathname();
  const counts = useSidebarCounts();

  return (
    <aside className="cockpit-sidebar" aria-label="主导航">
      <Link href="/" className="cockpit-brand">
        <span className="cockpit-brand-mark">W</span>
        <span>
          <strong>WorkHub</strong>
          <small>PERSONAL · v2</small>
        </span>
      </Link>

      <div className="cockpit-nav-group">
        <span className="cockpit-nav-label">MAIN</span>
        {mainItems.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const count = item.count ? counts[item.count] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`cockpit-nav-item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
              {count !== undefined && <small className="cockpit-nav-count">{count}</small>}
            </Link>
          );
        })}
      </div>

      <div className="cockpit-nav-group">
        <span className="cockpit-nav-label">INBOXES</span>
        {inboxItems.map((item) => {
          const count = counts[item.count];
          return (
            <Link key={item.href} href={item.href} className="cockpit-nav-item">
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
              <small className="cockpit-nav-count">{count}</small>
            </Link>
          );
        })}
      </div>

      <div className="cockpit-nav-group">
        <span className="cockpit-nav-label">TOOLS</span>
        {toolItems.map((item) => (
          <Link key={item.href} href={item.href} className="cockpit-nav-item">
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="cockpit-sidebar-footer">
        <i /> LOCAL SQLITE
      </div>
    </aside>
  );
}
