"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

const navItems = [
  { href: "/", label: "工作台", icon: "home", exact: true },
  { href: "/projects", label: "项目", icon: "folder" },
  { href: "/items", label: "事项", icon: "list" },
  { href: "/logs", label: "日志", icon: "file-text" },
  { href: "/reports", label: "汇报", icon: "chart", exact: true },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

export default function MobilePrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-primary-nav" aria-label="移动端主导航">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-primary-nav__item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
