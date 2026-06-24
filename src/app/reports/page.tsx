import Link from "next/link";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-kicker">
            <span className="page-hero-dot" />
            COMING SOON
          </div>
          <h1>汇报中心</h1>
          <p className="page-hero-subtitle">
            聚合日报、周报导出，按项目/时间维度生成汇报材料。
          </p>
        </div>
      </section>

      <section className="placeholder-section">
        <div className="card placeholder-card">
          <div className="placeholder-icon">
            <Icon name="chart" size={32} />
          </div>
          <h3>汇报功能开发中</h3>
          <p>
            此页面将整合日报、周报导出功能，支持按项目维度生成汇报。
            当前可使用以下快捷入口：
          </p>
          <div className="placeholder-actions">
            <Link href="/today" className="btn btn-primary">
              <Icon name="calendar" size={15} />
              今日视图
            </Link>
            <Link href="/export/today" className="btn btn-secondary">
              <Icon name="download" size={15} />
              导出日报
            </Link>
            <Link href="/stats" className="btn btn-secondary">
              <Icon name="chart" size={15} />
              统计概览
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
