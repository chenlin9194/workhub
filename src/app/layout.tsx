import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Work Hub - 本地工作事项集散中心",
  description: "面向手机 OS 软件项目经理的本地工作事项与日志管理工具",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [openItems, unarchivedFacts, openActionItems] = await Promise.all([
    prisma.workItem.count({ where: { status: { not: "closed" } } }),
    prisma.workLog.count({ where: { itemId: null } }),
    prisma.actionItem.count({ where: { status: { not: "done" } } }),
  ]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell counts={{ openItems, unarchivedFacts, openActionItems }}>
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
