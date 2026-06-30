import Link from "next/link";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const reportEntrances = [
  {
    href: "/export/today",
    icon: "calendar",
    title: "今日日报事实包",
    subtitle: "导出今天的日志、事项、风险、决策事实，适合直接复制给外部 AI 继续整理。",
    tone: "btn-primary",
  },
  {
    href: "/export/range",
    icon: "download",
    title: "区间 / 周报事实包",
    subtitle: "按时间范围导出工作记录，适合周报、阶段汇总和回顾场景。",
    tone: "btn-secondary",
  },
  {
    href: "/projects",
    icon: "clipboard-list",
    title: "项目快照事实包",
    subtitle: "先进入项目列表，再打开具体项目的快照页查看项目状态、风险和里程碑。",
    tone: "btn-secondary",
  },
  {
    href: "/stats",
    icon: "chart",
    title: "统计概览",
    subtitle: "查看事项和日志的整体统计，快速判断当前交付健康度。",
    tone: "btn-secondary",
  },
] as const;

const quickLinks = [
  {
    href: "/today",
    label: "今日视图",
    icon: "calendar",
    note: "快速查看今天的工作台。",
  },
] as const;

const workflowSteps = [
  "先选入口：日报、区间、项目快照或统计概览。",
  "把生成的 Markdown 当作事实包，直接复制给外部 AI 或其它工具。",
  "让外部 AI 负责整理表达，不要让它补写事实或自动下结论。",
  "如果缺少关键信息，先回到 WorkHub 人工确认，再继续汇报。",
];

export default function ReportsPage() {
  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-kicker">
            <span className="page-hero-dot" />
            FACT PACKAGE HUB
          </div>
          <h1>汇报入口</h1>
          <p className="page-hero-subtitle">
            这里不是汇报结论生成器，而是 WorkHub 的事实包入口。先把事实整理出来，再交给外部 AI 组织成日报、周报或管理层汇报。
          </p>
          <div className="page-hero-actions">
            <Link href="/export/today" className="btn btn-primary">
              <Icon name="calendar" size={15} />
              今日日报事实包
            </Link>
            <Link href="/projects" className="btn btn-secondary">
              <Icon name="folder" size={15} />
              项目快照
            </Link>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">ENTRANCES</span>
            <h2>汇报入口卡片</h2>
          </div>
        </div>

        <div className="content-card-grid">
          {reportEntrances.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="card card-hover"
              style={{
                padding: 18,
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minHeight: 188,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--bg-secondary)",
                    color: "var(--accent-blue)",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon name={entry.icon} size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>
                    {entry.title}
                  </h3>
                  <p style={{ margin: "6px 0 0", color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1.65 }}>
                    {entry.subtitle}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "auto" }}>
              <span className={`btn ${entry.tone}`} style={{ pointerEvents: "none" }}>
                  <Icon name="chevron-right" size={14} />
                  打开入口
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">WORKFLOW</span>
            <h2>使用流程</h2>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {workflowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">BOUNDARY</span>
            <h2>边界提示</h2>
          </div>
        </div>

        <div className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
          <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 650 }}>
            WorkHub 只提供事实包入口，不在这里生成管理结论。
          </p>
          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            复制后的 Markdown 可以交给外部 AI 继续整理成汇报，但外部 AI 不能补写事实。缺失信息先人工确认，再继续输出。
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 8 }}>
        <div className="dashboard-section-title">
          <div>
            <span className="section-eyebrow">SHORTCUTS</span>
            <h2>快捷链接</h2>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="btn btn-secondary">
                <Icon name={link.icon} size={14} />
                {link.label}
              </Link>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", color: "var(--text-tertiary)", fontSize: 12, lineHeight: 1.6 }}>
            {quickLinks[0].note}
          </p>
        </div>
      </section>
    </div>
  );
}
