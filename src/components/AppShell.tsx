"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import MobilePrimaryNav from "./MobilePrimaryNav";
import { useTheme } from "./ThemeProvider";
import SidebarNavigation from "./SidebarNavigation";
import { SidebarCountsProvider, type SidebarCounts } from "./SidebarCountsContext";

interface ToolLink {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
}

function getShellTitle(pathname: string) {
  if (pathname === "/") {
    return { path: "工作台 / Cockpit Dashboard", title: "工作台" };
  }

  if (pathname.startsWith("/projects/")) {
    if (pathname.endsWith("/snapshot")) return { path: "项目 / 快照", title: "项目快照" };
    if (pathname.endsWith("/edit")) return { path: "项目 / 编辑", title: "编辑项目" };
    if (pathname === "/projects/new") return { path: "项目 / 新建", title: "新建项目" };
    return { path: "项目 / 详情", title: "项目详情" };
  }

  if (pathname.startsWith("/items/")) {
    if (pathname.endsWith("/edit")) return { path: "事项 / 编辑", title: "编辑事项" };
    if (pathname === "/items/new") return { path: "事项 / 新建", title: "新建事项" };
    return { path: "事项 / 详情", title: "事项详情" };
  }

  if (pathname.startsWith("/logs/")) {
    if (pathname.endsWith("/edit")) return { path: "日志 / 编辑", title: "编辑日志" };
    if (pathname === "/logs/new") return { path: "日志 / 新建", title: "新建日志" };
    return { path: "日志 / 详情", title: "日志详情" };
  }

  if (pathname === "/projects") return { path: "项目 / 列表", title: "项目列表" };
  if (pathname === "/items") return { path: "事项 / 列表", title: "事项列表" };
  if (pathname === "/logs") return { path: "日志 / 列表", title: "日志列表" };
  if (pathname === "/reports") return { path: "汇报 / 入口", title: "汇报入口" };
  if (pathname === "/today") return { path: "今日视图", title: "今日视图" };
  if (pathname === "/stats") return { path: "统计概览", title: "统计概览" };
  if (pathname === "/settings/tools") return { path: "工具 / 设置", title: "工具设置" };

  return { path: pathname, title: pathname };
}

export default function AppShell({
  children,
  counts,
}: {
  children: React.ReactNode;
  counts: SidebarCounts;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [toolLinksLoaded, setToolLinksLoaded] = useState(false);
  const [toolLinksData, setToolLinksData] = useState<ToolLink[]>([]);
  const toolMenuRef = useRef<HTMLDivElement>(null);

  const shellTitle = useMemo(() => getShellTitle(pathname), [pathname]);
  const availableToolLinks = toolLinksData.filter((tool) => tool.enabled && tool.url.trim());

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
          setToolLinksData(Array.isArray(data.toolLinks) ? data.toolLinks : []);
          setToolLinksLoaded(true);
        }
      } catch (error) {
        console.error("Error fetching tool links:", error);
        if (!cancelled) {
          setToolLinksData([]);
          setToolLinksLoaded(true);
        }
      }
    };

    fetchToolLinks();

    return () => {
      cancelled = true;
    };
  }, [toolMenuOpen]);

  return (
    <SidebarCountsProvider counts={counts}>
      {pathname === "/" ? (
        <>
          {children}
          <MobilePrimaryNav />
        </>
      ) : (
      <div className="dashboard-shell">
        <SidebarNavigation />

        <div className="cockpit-content">
        <header className="cockpit-topbar app-shell-topbar">
          <div className="cockpit-topbar-context">
            <span className="cockpit-path" title={shellTitle.title}>
              {shellTitle.path}
            </span>
          </div>

          <form action="/items" className="cockpit-search">
            <Icon name="search" size={14} />
            <input type="hidden" name="visibility" value="open" />
            <input name="keyword" placeholder="搜索事项、项目、日志" />
          </form>

          <div className="cockpit-topbar-actions">
            <button
              type="button"
              onClick={toggle}
              className="cockpit-icon-btn"
              title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={15} />
            </button>

            <div ref={toolMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setToolMenuOpen((open) => !open)}
                className="cockpit-icon-btn"
                title="常用工具"
                aria-haspopup="menu"
                aria-expanded={toolMenuOpen}
              >
                <Icon name="menu" size={15} />
              </button>

              {toolMenuOpen && (
                <div
                  role="menu"
                  className="shell-tool-menu"
                >
                  {!toolLinksLoaded ? (
                    <div className="shell-tool-menu__status">加载中...</div>
                  ) : availableToolLinks.length === 0 ? (
                    <div className="shell-tool-menu__status">暂无可用工具入口</div>
                  ) : (
                    availableToolLinks.map((tool) => (
                      <a
                        key={tool.id}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        className="shell-tool-menu__item"
                      >
                        <span>{tool.name}</span>
                        <Icon name="external-link" size={14} />
                      </a>
                    ))
                  )}

                  <div className="shell-tool-menu__footer">
                    <Link href="/settings/tools" role="menuitem" className="shell-tool-menu__item">
                      <span>管理常用工具</span>
                      <Icon name="settings" size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-main app-shell-main page-enter">
          {children}
        </main>
        </div>
      </div>
      )}
      {pathname !== "/" && <MobilePrimaryNav />}
    </SidebarCountsProvider>
  );
}
