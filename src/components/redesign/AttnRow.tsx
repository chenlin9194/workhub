import Link from "next/link";

export default function AttnRow({
  href,
  reason,
  tone = "neutral",
  code,
  title,
  subtitle,
  owner,
  due,
}: {
  href: string;
  reason: string;
  tone?: "critical" | "warning" | "neutral";
  code: string;
  title: string;
  subtitle: string;
  owner?: string | null;
  due?: string | null;
}) {
  return (
    <Link href={href} className="redesign-attn-row">
      <span className={`redesign-attn-reason is-${tone}`}>{reason}</span>
      <span className="redesign-attn-code">{code}</span>
      <span className="redesign-attn-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="redesign-attn-side">
        <b>{due || "未设日期"}</b>
        {owner && <small>{owner}</small>}
      </span>
    </Link>
  );
}
