import Link from "next/link";
import { WORK_LOG_TYPE_LABELS } from "@/lib/constants";

export type Fact = {
  id: string;
  workDate: string;
  title: string;
  content: string;
  type: string;
  source: string;
  project?: string | null;
  itemId?: string | null;
  item?: { id: string; title: string } | null;
  reportable?: boolean | null;
  createdAt: Date;
};

function isChange(fact: Fact) {
  return fact.type === "update" && fact.title.startsWith("事项变化：");
}

function factKind(fact: Fact) {
  if (isChange(fact)) return { label: "变更", className: "change" };
  if (fact.type === "blocker") return { label: "阻塞", className: "blocker" };
  if (fact.type === "risk") return { label: "风险", className: "risk" };
  if (fact.type === "decision") return { label: "决策", className: "decision" };
  if (fact.type === "update") return { label: "进展", className: "progress" };
  return { label: WORK_LOG_TYPE_LABELS[fact.type] || "备注", className: "note" };
}

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}

export default function FactRow({ fact }: { fact: Fact }) {
  const kind = factKind(fact);
  const title = isChange(fact) ? fact.content : fact.title;
  const detail = isChange(fact) ? undefined : fact.content;

  return (
    <div className="redesign-fact-row">
      <time>{timeLabel(fact.createdAt)}</time>
      <span className={`redesign-fact-kind is-${kind.className}`}>{kind.label}</span>
      <div className="redesign-fact-copy">
        <p>{title}</p>
        {detail && detail !== title && <small>{detail}</small>}
        <div>
          {fact.item && (
            <Link href={`/items/${fact.item.id}`} className="redesign-fact-bind">
              → {fact.item.title}
            </Link>
          )}
          {fact.project && <span>{fact.project}</span>}
          {fact.reportable && <span>可汇报</span>}
        </div>
      </div>
    </div>
  );
}
