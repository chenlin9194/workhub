"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROJECT_TYPES,
  PROJECT_STATUSES,
  PROJECT_STAGES,
  HEALTH_OPTIONS,
} from "@/lib/constants";

export default function NewProjectPage() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
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
      submitButtonRef.current.textContent = "创建中...";
    }
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const project = await res.json();
        window.location.assign(`/projects/${project.id}`);
        return;
      }

      const error = await res.json();
      alert(error.error || "创建失败");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = "创建项目";
      }
      setLoading(false);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("创建失败");
      submittingRef.current = false;
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.textContent = "创建项目";
      }
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 };
  const labelStyle = { display: "block" as const, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>新建项目</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
        创建项目用于聚合相关事项和日志，按项目维度追踪健康度和进展。
      </p>

      <form onSubmit={handleSubmit}>
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
                  placeholder="输入项目名称"
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
                  placeholder="如 OS14"
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
                placeholder="项目描述"
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
                  placeholder="负责人"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>PM</label>
                <input
                  type="text"
                  value={form.pm}
                  onChange={(e) => setForm({ ...form, pm: e.target.value })}
                  placeholder="项目经理"
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
                placeholder="当前状态、结论或摘要"
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
                  placeholder="下个里程碑"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>下一步行动</label>
                <input
                  type="text"
                  value={form.nextAction}
                  onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                  placeholder="下一步行动"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Source */}
            <div className="card form-section" style={{ padding: 16, background: "var(--bg-secondary)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>来源系统</label>
                    <input
                      type="text"
                      value={form.sourceSystem}
                      onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })}
                      placeholder="如 JIRA、飞书"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>来源编号</label>
                    <input
                      type="text"
                      value={form.sourceId}
                      onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                      placeholder="来源系统编号"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>来源链接</label>
                    <input
                      type="url"
                      value={form.sourceUrl}
                      onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                      placeholder="https://..."
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>标签</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="标签（用逗号分隔）"
                style={inputStyle}
              />
            </div>

            {/* Buttons */}
            <div className="field-actions form-footer">
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                取消
              </button>
              <button ref={submitButtonRef} type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "创建中..." : "创建项目"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
