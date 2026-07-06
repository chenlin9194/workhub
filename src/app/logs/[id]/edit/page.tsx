"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
      setItems(data.items || []);
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
    return (
      <div className="page-shell command-form-page log-entry-page">
        <div className="card form-card command-form-card command-form-message">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell command-form-page log-entry-page">
      <header className="command-form-header">
        <Link href={`/logs/${id}`} className="detail-back-link">
          ← 返回日志详情
        </Link>
        <div>
          <span className="section-eyebrow">COMMAND FORM / LOG</span>
          <h1>编辑日志</h1>
          <p>日志用于记录已经发生的关键事实、会议结论、风险暴露、阻塞原因、决策和可汇报素材。</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="card form-card command-form-card log-entry-card log-command-form-card">
          <div className="command-form-stack">
            <section className="command-form-section log-form-section-context">
              <div className="command-form-section-header">
                <h2>记录上下文</h2>
                <p>工作日期和关联事项。</p>
              </div>

              <div className="field-grid-2">
                <div className="form-field-narrow">
                  <label className="form-field-label">工作日期 *</label>
                  <input
                    type="date"
                    value={form.workDate}
                    onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                    required
                    className="input"
                  />
                </div>
                <div />
              </div>

              <div>
                <label className="form-field-label">关联事项</label>
                <select
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  className="form-field-control"
                >
                  <option value="">不关联</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="command-form-section log-form-section-content">
              <div className="command-form-section-header">
                <h2>日志内容</h2>
                <p>如果需要持续跟踪状态，请建事项；如果只是下一步谁做什么，请建行动项。</p>
              </div>

              <div>
                <label className="form-field-label">标题 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="form-field-control"
                />
              </div>

              <div>
                <label className="form-field-label">内容 *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  required
                  className="input log-content-input"
                />
              </div>
            </section>

            <section className="command-form-section log-form-section-taxonomy">
              <div className="command-form-section-header">
                <h2>分类与来源</h2>
                <p>类型、来源、模块、项目、标签与外部链接。</p>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">类型</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="form-field-control"
                  >
                    {WORK_LOG_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <p className="field-help">待办请优先创建行动项；日志只记录已经发生、未来需要解释或汇报的事实。</p>
                </div>
                <div>
                  <label className="form-field-label">来源</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="form-field-control"
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-field-label">模块</label>
                  <select
                    value={form.module}
                    onChange={(e) => setForm({ ...form, module: e.target.value })}
                    className="form-field-control"
                  >
                    <option value="">选择模块</option>
                    {MODULES.map((module) => (
                      <option key={module} value={module}>{module}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-grid-2">
                <div>
                  <label className="form-field-label">项目</label>
                  <input
                    type="text"
                    value={form.project}
                    onChange={(e) => setForm({ ...form, project: e.target.value })}
                    className="form-field-control"
                  />
                </div>
                <div>
                  <label className="form-field-label">标签</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="标签，用逗号分隔"
                    className="form-field-control"
                  />
                </div>
              </div>

              <div className="field-grid-2">
                <label className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={form.reportable}
                    onChange={(e) => setForm({ ...form, reportable: e.target.checked })}
                  />
                  可汇报
                </label>
                <div>
                  <label className="form-field-label">来源链接</label>
                  <input
                    type="url"
                    value={form.sourceUrl}
                    onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                    placeholder="https://..."
                    className="form-field-control"
                  />
                </div>
              </div>
            </section>

            <div className="command-form-actions">
              <span className="field-note">保存后会进入日志详情页。</span>
              <div className="command-form-actions-main">
                <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "保存中..." : "保存日志"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
