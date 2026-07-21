export default function Sparkline7d({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);

  return (
    <div className="redesign-sparkline" aria-label="七日阻塞趋势">
      <div>
        <span>7 日阻塞趋势</span>
        <small>PEAK {Math.max(...values, 0)}</small>
      </div>
      <div className="redesign-sparkline-bars">
        {values.map((value, index) => (
          <span key={labels[index]}>
            <i style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
            <b>{labels[index]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
