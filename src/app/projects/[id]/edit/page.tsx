"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  PROJECT_TYPES,
  PROJECT_STATUSES,
  PROJECT_STAGES,
  HEALTH_OPTIONS,
} from "@/lib/constants";

export default function EditProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const submittingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    type: "project",
    status: "active",
    stage: "",
    health: "unknown",
    owner: "",
    pm: "",
    startDate: "",
    targetDate: "",
    releaseDate: "",
    currentSummary: "",
    nextMilestone: "",
    nextAction: "",
    sourceSystem: "",
    sourceId: "",
    sourceUrl: "",
    tags: "",
  });

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setForm({
          name: data.name || "",
          code: data.code || "",
          description: data.description || "",
          type: data.type || "project",
          status: data.status || "active",
          stage: data.stage || "",
          health: data.health || "unknown",
          owner: data.owner || "",
          pm: data.pm || "",
          startDate: data.startDate ? new Date(data.startDate).toISOString().split("T")[0] : "",
          targetDate: data.targetDate ? new Date(data.targetDate).toISOString().split("T")[0] : "",
          releaseDate: data.releaseDate ? new Date(data.releaseDate).toISOString().split("T")[0] : "",
          currentSummary: data.currentSummary || "",
          nextMilestone: data.nextMilestone || "",
          nextAction: data.nextAction || "",
          sourceSystem: data.sourceSystem || "",
          sourceId: data.sourceId || "",
          sourceUrl: data.sourceUrl || "",
          tags: data.tags || "",
        });
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!form.name.trim()) {
      alert("项目名称不能为空");
      return;
    }

    submittingRef.current = true;
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
      submitButtonRef.current.textContent = "保存中...";
    }
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        window.location.assign(`/projects/${id}`);
        return;
      }

      const error = await res.json().catch(() => null);
      alert(error?.error || "更新失败");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = "保存修改";
      }
      setLoading(false);
    } catch (error) {
      console.error("Error updating project:", error);
      alert("更新失败");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = "保存修改";
      }
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="page-shell">
        <div className="card empty-state"><p>加载中...</p></div>
      </div>
    );
  }

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 };
  const labelStyle = { display: "block" as const, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link href={`/projects/${id}`} style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          <Icon name="arrow-left" size={14} /> 返回详情
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>编辑项目</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card form-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name & Code */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>项目名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>项目编码</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>描述</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" as const }}
              />
            </div>

            {/* Type, Status, Stage */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>类型</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>阶段</label>
                <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} style={inputStyle}>
                  <option value="">选择阶段</option>
                  {PROJECT_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Health, Owner, PM */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>健康度</label>
                <select value={form.health} onChange={(e) => setForm({ ...form, health: e.target.value })} style={inputStyle}>
                  {HEALTH_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>负责人</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>PM</label>
                <input
                  type="text"
                  value={form.pm}
                  onChange={(e) => setForm({ ...form, pm: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>开始日期</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>目标日期</label>
                <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>发布日期</label>
                <input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {/* Summary & Milestone */}
            <div>
              <label style={labelStyle}>当前摘要</label>
              <textarea
                value={form.currentSummary}
                onChange={(e) => setForm({ ...form, currentSummary: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" as const }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>下个里程碑</label>
                <input
                  type="text"
                  value={form.nextMilestone}
                  onChange={(e) => setForm({ ...form, nextMilestone: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>下一步行动</label>
                <input
                  type="text"
                  value={form.nextAction}
                  onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Source */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>来源系统</label>
                <input
                  type="text"
                  value={form.sourceSystem}
                  onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>来源编号</label>
                <input
                  type="text"
                  value={form.sourceId}
                  onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>来源链接</label>
                <input
                  type="text"
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>标签</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* Buttons */}
            <div className="field-actions form-footer">
              <Link href={`/projects/${id}`} className="btn btn-secondary">
                取消
              </Link>
              <button ref={submitButtonRef} type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
