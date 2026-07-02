"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { WORK_LOG_TYPES, SOURCES, MODULES } from "@/lib/constants";

export default function EditLogPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [form, setForm] = useState({
    workDate: "",
    title: "",
    content: "",
    type: "note",
    source: "manual",
    project: "",
    module: "",
    tags: "",
    itemId: "",
    reportable: false,
    sourceUrl: "",
  });

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/logs/${id}`);
      if (res.ok) {
        const log = await res.json();
        setForm({
          workDate: log.workDate || "",
          title: log.title || "",
          content: log.content || "",
          type: log.type || "note",
          source: log.source || "manual",
          project: log.project || "",
          module: log.module || "",
          tags: log.tags || "",
          itemId: log.itemId || "",
          reportable: Boolean(log.reportable),
          sourceUrl: log.sourceUrl || "",
        });
      } else {
        alert("日志不存在");
        router.push("/logs");
      }
    } catch (error) {
      console.error("Error fetching log:", error);
    } finally {
      setFetching(false);
    }
  }, [id, router]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/items?pageSize=100");
      const data = await res.json();
      setItems(data.items);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  }, []);

  useEffect(() => {
    fetchLog();
    fetchItems();
  }, [fetchItems, fetchLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!form.title.trim() || !form.content.trim()) {
      alert("标题和内容不能为空");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/logs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        router.refresh();
        router.push(`/logs/${id}`);
      } else {
        const error = await res.json();
        alert(error.error || "保存失败，请重试");
      }
    } catch (error) {
      console.error("Error updating log:", error);
      alert("保存失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>编辑工作日志</h1>

      <form onSubmit={handleSubmit}>
        <div className="card form-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>工作日期 *</label>
                <input type="date" value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} required style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>关联事项</label>
                <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}>
                  <option value="">不关联</option>
                  {items.map((item) => (<option key={item.id} value={item.id}>{item.title}</option>))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>标题 *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>内容 *</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} required style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>类型</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}>
                  {WORK_LOG_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>来源</label>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}>
                  {SOURCES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>模块</label>
                <select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}>
                  <option value="">选择模块</option>
                  {MODULES.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>项目</label>
                <input type="text" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>标签</label>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="标签（用逗号分隔）" style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label className="field-checkbox">
                <input
                  type="checkbox"
                  checked={form.reportable}
                  onChange={(e) => setForm({ ...form, reportable: e.target.checked })}
                />
                可汇报
              </label>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>来源链接</label>
                <input type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://..." style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }} />
              </div>
            </div>

            <div className="field-actions form-footer">
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">取消</button>
              <button type="submit" disabled={loading} className="btn btn-primary">{loading ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
