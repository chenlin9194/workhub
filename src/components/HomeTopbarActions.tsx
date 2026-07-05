"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { useTheme } from "./ThemeProvider";

interface ToolLink {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
}

export default function HomeTopbarActions() {
  const { theme, toggle } = useTheme();
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [toolLinksLoaded, setToolLinksLoaded] = useState(false);
  const [toolLinksData, setToolLinksData] = useState<ToolLink[]>([]);
  const toolMenuRef = useRef<HTMLDivElement>(null);
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
    <div className="cockpit-topbar-actions">
      <button
        type="button"
        onClick={toggle}
        className="cockpit-icon-btn"
        title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
      >
        <Icon name={theme === "light" ? "moon" : "sun"} size={15} />
      </button>

      <div ref={toolMenuRef} className="home-tool-menu-anchor">
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
          <div role="menu" className="shell-tool-menu">
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
  );
}
