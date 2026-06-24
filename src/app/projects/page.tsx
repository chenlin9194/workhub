import Link from "next/link";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-kicker">
            <span className="page-hero-dot" />
            COMING SOON
          </div>
          <h1>项目管理</h1>
          <p className="page-hero-subtitle">
            按项目维度聚合事项、追踪健康度、生成项目快照。
          </p>
        </div>
      </section>

      <section className="placeholder-section">
        <div className="card placeholder-card">
          <div className="placeholder-icon">
            <Icon name="folder" size={32} />
          </div>
          <h3>项目视图开发中</h3>
          <p>
            此页面将支持按项目维度查看事项分布、健康度汇总、风险追踪。
            当前可通过事项列表的「项目」筛选字段查看项目相关数据。
          </p>
          <div className="placeholder-actions">
            <Link href="/items" className="btn btn-primary">
              <Icon name="list" size={15} />
              查看事项列表
            </Link>
            <Link href="/" className="btn btn-secondary">
              <Icon name="home" size={15} />
              返回工作台
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
