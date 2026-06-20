"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";
import Icon from "./Icon";

const navItems = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/notes", label: "记录列表", icon: "list" },
  { href: "/notes/new", label: "新增记录", icon: "plus" },
  { href: "/today", label: "今日汇总", icon: "calendar" },
  { href: "/stats", label: "统计", icon: "chart" },
  { href: "/ai", label: "AI 助手", icon: "sparkles" },
  { href: "/ai/settings", label: "AI 配置", icon: "settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          {/* Logo */}
          <Link
            href="/"
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
            Work Log
          </Link>

          {/* Desktop Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }} className="hidden md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 8,
                    fontSize: 13, fontWeight: 500,
                    color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-blue-light)" : "transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--bg-tertiary)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Theme + Mobile toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
        {mobileOpen && (
          <div style={{
            padding: "8px 0 12px",
            display: "flex", flexDirection: "column", gap: 2,
          }}
          className="md:hidden"
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 8,
                    fontSize: 14, fontWeight: 500,
                    color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-blue-light)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
