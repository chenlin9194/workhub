"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import Icon from "./Icon";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", exact: true },
  { href: "/items", label: "工作事项", icon: "list" },
  { href: "/items/new", label: "新增事项", icon: "plus", exact: true },
  { href: "/logs", label: "工作日志", icon: "file-text" },
  { href: "/logs/new", label: "新增日志", icon: "plus", exact: true },
  { href: "/today", label: "今日视图", icon: "calendar", exact: true },
  { href: "/stats", label: "统计", icon: "chart", exact: true },
  { href: "/export/today", label: "导出", icon: "download", exact: true },
];

/**
 * Determine which nav item is "active" for the current pathname.
 *
 * Strategy: pick the MOST SPECIFIC match.
 *   1. Exact match always wins (e.g. pathname "/items/new" → item "/items/new")
 *   2. If no exact match, the longest prefix match wins
 *      (e.g. pathname "/items/abc123/edit" → item "/items")
 *   3. Items with `exact: true` only match on exact pathname equality
 *
 * This prevents "/items" and "/items/new" from both being highlighted.
 */
function getActiveHref(pathname: string, items: NavItem[]): string | null {
  // First pass: look for an exact match
  for (const item of items) {
    if (pathname === item.href) return item.href;
  }
  // Second pass: longest prefix match (skip exact-only items)
  let bestMatch: string | null = null;
  for (const item of items) {
    if (item.exact) continue;
    if (pathname.startsWith(item.href + "/")) {
      if (!bestMatch || item.href.length > bestMatch.length) {
        bestMatch = item.href;
      }
    }
  }
  return bestMatch;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeHref = getActiveHref(pathname, navItems);

  // Smooth navigation with React transition
  const handleNav = useCallback(
    (href: string, e: React.MouseEvent) => {
      e.preventDefault();
      setMobileOpen(false);
      if (href === pathname) return; // already there
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router]
  );

  return (
    <nav className="navbar">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          {/* Logo */}
          <Link
            href="/"
            onClick={(e) => handleNav("/", e)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontWeight: 700, fontSize: 16, color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
              color: "white", fontSize: 14,
            }}>
              <Icon name="clipboard-list" size={18} />
            </span>
            Work Hub
          </Link>

          {/* Desktop Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }} className="hidden md:flex">
            {navItems.map((item) => {
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={(e) => handleNav(item.href, e)}
                  className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Theme + Mobile toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Navigation loading indicator */}
            {isPending && (
              <div className="nav-loading-dot" />
            )}
            <button
              onClick={toggle}
              className="btn btn-ghost btn-sm"
              title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn btn-ghost btn-sm md:hidden"
            >
              <Icon name={mobileOpen ? "x" : "menu"} size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div
          className="md:hidden"
          style={{
            overflow: "hidden",
            maxHeight: mobileOpen ? 400 : 0,
            opacity: mobileOpen ? 1 : 0,
            transition: "max-height 0.25s ease, opacity 0.2s ease",
            paddingBottom: mobileOpen ? 12 : 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 8 }}>
            {navItems.map((item) => {
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={(e) => handleNav(item.href, e)}
                  className={`nav-link-mobile ${isActive ? "nav-link-mobile-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
