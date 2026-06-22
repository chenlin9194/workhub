import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Work Hub - 本地工作事项集散中心",
  description: "面向手机 OS 软件项目经理的本地工作事项与日志管理工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Navbar />
          <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }} className="page-enter">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
