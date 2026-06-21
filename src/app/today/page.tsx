import { prisma } from "@/lib/prisma";
import Link from "next/link";
import WorkItemCard from "@/components/WorkItemCard";
import WorkLogCard from "@/components/WorkLogCard";
import { formatTodayStr, getTodayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = getTodayStr();
  const todayStart = new Date(today);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    todayLogs,
    todayClosedItems,
    todayUpdatedItems,
    p0p1Items,
    todayDueItems,
    overdueItems,
    riskBlockerLogs,
    decisionLogs,
  ] = await Promise.all([
    prisma.workLog.findMany({
      where: { workDate: today },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workItem.findMany({
      where: { closedAt: { gte: todayStart, lt: todayEnd } },
      orderBy: { closedAt: "desc" },
    }),
    prisma.workItem.findMany({
      where: { updatedAt: { gte: todayStart, lt: todayEnd } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.workItem.findMany({
      where: { priority: { in: ["P0", "P1"] }, status: { not: "closed" } },
      orderBy: { priority: "asc" },
    }),
    prisma.workItem.findMany({
      where: { dueDate: today, status: { not: "closed" } },
      orderBy: { priority: "asc" },
    }),
    prisma.workItem.findMany({
      where: { dueDate: { lt: today }, status: { not: "closed" } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.workLog.findMany({
      where: { workDate: today, type: { in: ["risk", "blocker"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workLog.findMany({
      where: { workDate: today, type: "decision" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sections = [
    { title: "今日新增日志", items: todayLogs, type: "log", count: todayLogs.length },
    { title: "今日关闭事项", items: todayClosedItems, type: "item", count: todayClosedItems.length },
    { title: "今日更新事项", items: todayUpdatedItems, type: "item", count: todayUpdatedItems.length },
    { title: "P0/P1 未关闭事项", items: p0p1Items, type: "item", count: p0p1Items.length },
    { title: "今日到期事项", items: todayDueItems, type: "item", count: todayDueItems.length },
    { title: "逾期未关闭事项", items: overdueItems, type: "item", count: overdueItems.length },
    { title: "今日风险/阻塞日志", items: riskBlockerLogs, type: "log", count: riskBlockerLogs.length },
    { title: "今日决策日志", items: decisionLogs, type: "log", count: decisionLogs.length },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>今日工作视图</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>{formatTodayStr()}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/export/today" className="btn btn-secondary">导出今日</Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="card" style={{ padding: "12px 16px", display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
        <span style={{ color: "var(--text-tertiary)" }}>今日日志 <strong style={{ color: "var(--text-primary)" }}>{todayLogs.length}</strong> 条</span>
        <span style={{ color: "var(--text-tertiary)" }}>关闭事项 <strong style={{ color: "var(--accent-green)" }}>{todayClosedItems.length}</strong></span>
        <span style={{ color: "var(--text-tertiary)" }}>更新事项 <strong style={{ color: "var(--accent-blue)" }}>{todayUpdatedItems.length}</strong></span>
        <span style={{ color: "var(--text-tertiary)" }}>P0/P1 <strong style={{ color: "var(--accent-red)" }}>{p0p1Items.length}</strong></span>
        <span style={{ color: "var(--text-tertiary)" }}>逾期 <strong style={{ color: "var(--accent-red)" }}>{overdueItems.length}</strong></span>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} className="card" style={{ overflow: "hidden" }}>
          <div className="section-header">
            <span>{section.title}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)", fontWeight: 400 }}>
              {section.count} 条
            </span>
          </div>
          {section.items.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              暂无数据
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              {section.type === "log" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                  {(section.items as { id: string; workDate: string; title: string; content: string; type: string; source: string; project?: string | null; module?: string | null; itemId?: string | null; createdAt: Date; updatedAt: Date }[]).map((log) => (
                    <WorkLogCard key={log.id} log={log} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                  {(section.items as { id: string; title: string; description?: string | null; project?: string | null; module?: string | null; type: string; priority: string; status: string; owner?: string | null; dueDate?: string | null; createdAt: Date; updatedAt: Date; closedAt?: Date | null }[]).map((item) => (
                    <WorkItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
