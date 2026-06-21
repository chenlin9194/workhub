"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";

export default function ExportRangePage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!start || !end) {
      alert("请选择开始和结束日期");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/export/range?start=${start}&end=${end}&format=markdown`);
      if (res.ok) {
        const md = await res.text();
        setMarkdown(md);
      } else {
        alert("导出失败");
      }
    } catch (error) {
      console.error("Error exporting:", error);
      alert("导出失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>日期范围导出</h1>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>开始日期</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>结束日期</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
            />
          </div>
          <button onClick={handleExport} disabled={loading} className="btn btn-primary">
            {loading ? "导出中..." : "导出"}
          </button>
        </div>
      </div>

      {markdown && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <CopyButton text={markdown} />
          </div>
          <div className="card" style={{ padding: 24 }}>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)" }}>
              {markdown}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
