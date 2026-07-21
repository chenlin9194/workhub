import type { ReactNode } from "react";

export default function Panel({
  tag,
  title,
  meta,
  children,
  className = "",
}: {
  tag: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`redesign-panel ${className}`.trim()}>
      <header className="redesign-panel-head">
        <span>{tag}</span>
        <h3>{title}</h3>
        {meta && <div className="redesign-panel-meta">{meta}</div>}
      </header>
      <div className="redesign-panel-body">{children}</div>
    </section>
  );
}
