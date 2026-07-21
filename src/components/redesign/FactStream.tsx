import FactRow, { type Fact } from "./FactRow";

function groupLabel(workDate: string, today: string, yesterday: string) {
  if (workDate === today) return `TODAY · ${workDate}`;
  if (workDate === yesterday) return `YESTERDAY · ${workDate}`;
  return workDate;
}

export default function FactStream({
  facts,
  today,
  yesterday,
}: {
  facts: Fact[];
  today: string;
  yesterday: string;
}) {
  const groups = facts.reduce<Map<string, Fact[]>>((result, fact) => {
    const group = result.get(fact.workDate) || [];
    group.push(fact);
    result.set(fact.workDate, group);
    return result;
  }, new Map());

  if (facts.length === 0) {
    return <div className="redesign-empty">近两天尚无事实记录。</div>;
  }

  return (
    <div className="redesign-fact-stream">
      {Array.from(groups.entries()).map(([workDate, entries]) => (
        <section key={workDate}>
          <h4>{groupLabel(workDate, today, yesterday)} · {entries.length} 条</h4>
          {entries.map((fact) => <FactRow key={fact.id} fact={fact} />)}
        </section>
      ))}
    </div>
  );
}
