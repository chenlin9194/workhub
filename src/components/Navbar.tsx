"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type MouseEvent as ReactMouseEvent } from "react";
import { useTheme } from "./ThemeProvider";
import Icon from "./Icon";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

interface ToolLink {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
}

const refreshTargets = new Set(["/", "/today", "/items", "/logs", "/stats"]);

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", exact: true },
  { href: "/today", label: "今日视图", icon: "calendar", exact: true },
  { href: "/logs/new", label: "记录日志", icon: "edit", exact: true },
  { href: "/items", label: "工作事项", icon: "list" },
  { href: "/logs", label: "工作日志", icon: "file-text" },
  { href: "/export/today", label: "导出", icon: "download", exact: true },
  { href: "/stats", label: "统计", icon: "chart", exact: true },
];

function getActiveHref(pathname: string, items: NavItem[]): string | null {
  for (const item of items) {
    if (pathname === item.href) return item.href;
  }

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
  const [isPending, startTransition] = useTransition();
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [toolLinks, setToolLinks] = useState<ToolLink[]>([]);
  const [toolLinksLoaded, setToolLinksLoaded] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement>(null);

  const activeHref = getActiveHref(pathname, navItems);

  const handleNav = useCallback(
    (href: string, e: ReactMouseEvent) => {
      e.preventDefault();
      setToolMenuOpen(false);
      if (href === pathname) return;
      startTransition(() => {
        router.push(href);
        if (refreshTargets.has(href)) {
          router.refresh();
        }
      });
    },
    [pathname, router, startTransition]
  );

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (toolMenuRef.current && !toolMenuRef.current.contains(event.target as Node)) {
        setToolMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setToolMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!toolMenuOpen) return;

    let cancelled = false;

    const fetchToolLinks = async () => {
      try {
        const res = await fetch("/api/tool-links", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setToolLinks(Array.isArray(data.toolLinks) ? data.toolLinks : []);
          setToolLinksLoaded(true);
        }
      } catch (error) {
        console.error("Error fetching tool links:", error);
        if (!cancelled) {
          setToolLinks([]);
          setToolLinksLoaded(true);
        }
      }
    };

    fetchToolLinks();

    return () => {
      cancelled = true;
    };
  }, [toolMenuOpen]);

  const availableToolLinks = toolLinks.filter((tool) => tool.enabled && tool.url.trim());

  return (
    <nav className="navbar">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link
            href="/"
            onClick={(e) => handleNav("/", e)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: 16,
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                color: "white",
                fontSize: 14,
              }}
            >
              <Icon name="clipboard-list" size={18} />
            </span>
            Work Hub
          </Link>

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

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isPending && <div className="nav-loading-dot" />}
            <button
              onClick={toggle}
              className="btn btn-ghost btn-sm"
              title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
            </button>

            <div ref={toolMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setToolMenuOpen((open) => !open)}
                className="btn btn-ghost btn-sm"
                title="常用工具"
                aria-haspopup="menu"
                aria-expanded={toolMenuOpen}
              >
                <Icon name="menu" size={18} />
                <span style={{ marginLeft: 6 }}>常用工具</span>
              </button>

              {toolMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    minWidth: 260,
                    padding: 8,
                    borderRadius: 12,
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
                    zIndex: 30,
                  }}
                >
                  {!toolLinksLoaded ? (
                    <div
                      style={{
                        padding: "12px 12px",
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        whiteSpace: "normal",
                      }}
                    >
                      加载中...
                    </div>
                  ) : availableToolLinks.length === 0 ? (
                    <div
                      style={{
                        padding: "12px 12px",
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        whiteSpace: "normal",
                      }}
                    >
                      暂无常用工具，请到 常用工具设置 中添加。
                    </div>
                  ) : (
                    availableToolLinks.map((tool) => (
                      <a
                        key={tool.id}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 8,
                          color: "var(--text-primary)",
                          textDecoration: "none",
                          fontSize: 14,
                        }}
                      >
                        <span>{tool.name}</span>
                        <Icon name="external-link" size={14} />
                      </a>
                    ))
                  )}

                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-primary)" }}>
                    <Link
                      href="/settings/tools"
                      onClick={() => setToolMenuOpen(false)}
                      role="menuitem"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        color: "var(--text-primary)",
                        textDecoration: "none",
                        fontSize: 14,
                      }}
                    >
                      <span>管理常用工具</span>
                      <Icon name="settings" size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
