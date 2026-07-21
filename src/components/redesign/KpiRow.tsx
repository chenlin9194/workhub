import Link from "next/link";

export type KpiStat = {
  label: string;
  value: number;
  name: string;
  meta: string;
  href: string;
  tone?: "critical" | "warning" | "positive" | "accent";
};

export default function KpiRow({ stats, activeFocus }: { stats: KpiStat[]; activeFocus?: string | null }) {
  return (
    <div className="redesign-kpi-row" aria-label="工作台指标">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href} className={`redesign-kpi${stat.tone ? ` is-${stat.tone}` : ""}${activeFocus && stat.href.includes(`focus=${activeFocus}`) ? " is-selected" : ""}`}>
          <span className="redesign-kpi-label">{stat.label}</span>
          <strong>{stat.value}</strong>
          <span className="redesign-kpi-name">{stat.name}</span>
          <small>{stat.meta}</small>
        </Link>
      ))}
    </div>
  );
}
