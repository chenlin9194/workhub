"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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

  return (
    <div className="page-shell command-form-page">
      <header className="command-form-header">
        <Link href="/projects" className="detail-back-link">
          ← 返回项目列表
        </Link>
        <div>
          <span className="section-eyebrow">COMMAND FORM / PROJECT</span>
          <h1>新建项目</h1>
          <p>录入项目的基本信息、态势摘要、时间节点和来源标签，保持与 cockpit 一致的扫读方式。</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="card form-card command-form-card">
          <div className="command-form-stack">
            <section className="command-form-section">
              <div className="command-form-section-header">
                <h2>基础信息</h2>
                <p>项目名称、编码与描述。</p>
              </div>

              <div className="field-grid-2">
                <div>
                  <label className="form-field-label">项目名称 *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="输入项目名称"
                    required
                    className="form-field-control"
                  />
                </div>
                <div>
                  <label className="form-field-label">项目编码</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="例如 OS14"
                    className="form-field-control"
                  />
                </div>
              </div>

              <div>
                <label className="form-field-label">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="项目描述"
                  rows={3}
                  className="form-field-control form-field-textarea"
                />
              </div>
            </section>

            <section className="command-form-section">
              <div className="command-form-section-header">
                <h2>状态与责任</h2>
                <p>类型、状态、阶段、健康度与 owner / PM。</p>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">类型</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="form-field-control">
                    {PROJECT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-field-label">状态</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="form-field-control">
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-field-label">阶段</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="form-field-control">
                    <option value="">选择阶段</option>
                    {PROJECT_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">健康度</label>
                  <select value={form.health} onChange={(e) => setForm({ ...form, health: e.target.value })} className="form-field-control">
                    {HEALTH_OPTIONS.map((h) => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-field-label">负责人</label>
                  <input
                    type="text"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    placeholder="可选"
                    className="form-field-control"
                  />
                </div>
                <div>
                  <label className="form-field-label">PM</label>
                  <input
                    type="text"
                    value={form.pm}
                    onChange={(e) => setForm({ ...form, pm: e.target.value })}
                    placeholder="项目经理"
                    className="form-field-control"
                  />
                </div>
              </div>
            </section>

            <section className="command-form-section">
              <div className="command-form-section-header">
                <h2>时间节点</h2>
                <p>开始、目标与发布时间。</p>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">开始日期</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="form-field-control" />
                </div>
                <div>
                  <label className="form-field-label">目标日期</label>
                  <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className="form-field-control" />
                </div>
                <div>
                  <label className="form-field-label">发布日期</label>
                  <input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} className="form-field-control" />
                </div>
              </div>
            </section>

            <section className="command-form-section">
              <div className="command-form-section-header">
                <h2>交付摘要</h2>
                <p>当前摘要、下一里程碑和下一步动作。</p>
              </div>

              <div>
                <label className="form-field-label">当前摘要</label>
                <textarea
                  value={form.currentSummary}
                  onChange={(e) => setForm({ ...form, currentSummary: e.target.value })}
                  placeholder="当前状态、结论或摘要"
                  rows={3}
                  className="form-field-control form-field-textarea"
                />
              </div>

              <div className="field-grid-2">
                <div>
                  <label className="form-field-label">下一个里程碑</label>
                  <input
                    type="text"
                    value={form.nextMilestone}
                    onChange={(e) => setForm({ ...form, nextMilestone: e.target.value })}
                    placeholder="下一个里程碑"
                    className="form-field-control"
                  />
                </div>
                <div>
                  <label className="form-field-label">下一步行动</label>
                  <input
                    type="text"
                    value={form.nextAction}
                    onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
                    placeholder="下一步行动"
                    className="form-field-control"
                  />
                </div>
              </div>
            </section>

            <section className="command-form-section">
              <div className="command-form-section-header">
                <h2>来源与标签</h2>
                <p>外部来源、追踪编号和检索标签。</p>
              </div>

              <div className="field-grid-3">
                <div>
                  <label className="form-field-label">来源系统</label>
                  <input
                    type="text"
                    value={form.sourceSystem}
                    onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })}
                    placeholder="例如 JIRA / 飞书"
                    className="form-field-control"
                  />
                </div>
                <div>
                  <label className="form-field-label">来源编号</label>
                  <input
                    type="text"
                    value={form.sourceId}
                    onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                    placeholder="来源系统编号"
                    className="form-field-control"
                  />
                </div>
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
            </section>

            <div className="command-form-actions">
              <span className="field-note">保存后会进入项目详情页。</span>
              <div className="command-form-actions-main">
                <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                  取消
                </button>
                <button ref={submitButtonRef} type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "创建中..." : "创建项目"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
