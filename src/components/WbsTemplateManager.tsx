"use client";

import { useEffect, useRef, useState } from "react";

interface WbsTemplateSummary {
  id: string;
  version: string;
  sourceFileName: string;
  status: string;
  importedAt: string;
  _count: { nodes: number };
}

function importedAtLabel(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

export default function WbsTemplateManager() {
  const [activeTemplate, setActiveTemplate] = useState<WbsTemplateSummary | null>(null);
  const [templates, setTemplates] = useState<WbsTemplateSummary[]>([]);
  const [version, setVersion] = useState("V2.0");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitRef = useRef(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/wbs/templates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取 WBS 模板失败");
      setActiveTemplate(data.activeTemplate || null);
      setTemplates(data.templates || []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "读取 WBS 模板失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitRef.current) return;
    if (!file) {
      setError("请选择 XLSX 模板文件");
      return;
    }

    submitRef.current = true;
    setWorking(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("version", version.trim() || "V2.0");
      const response = await fetch("/api/wbs/templates", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "导入 WBS 模板失败");
      setMessage(`${data.message}，共 ${data.result.nodeCount} 个节点。`);
      setFile(null);
      await loadTemplates();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "导入 WBS 模板失败");
    } finally {
      submitRef.current = false;
      setWorking(false);
    }
  };

  return (
    <section id="wbs-template" className="card wbs-template-manager">
      <div className="tool-list-header">
        <div>
          <span className="section-eyebrow">WBS / GLOBAL TEMPLATE</span>
          <h2>全局 WBS 模板</h2>
          <p className="entity-card-note">所有项目共用同一套 WBS 任务；项目只保存自己的执行进度。</p>
        </div>
        <div className="entity-pill entity-pill--success">{activeTemplate ? `当前 ${activeTemplate.version}` : "尚未配置"}</div>
      </div>

      <div className="wbs-template-manager-body">
        {loading ? (
          <p>正在读取模板状态…</p>
        ) : activeTemplate ? (
          <div className="wbs-template-status">
            <strong>{activeTemplate.sourceFileName}</strong>
            <span>{activeTemplate._count.nodes} 个节点 · 导入于 {importedAtLabel(activeTemplate.importedAt)}</span>
          </div>
        ) : (
          <p className="project-cockpit-empty">尚未导入全局 WBS 模板。导入后，所有项目都可以使用。</p>
        )}

        <form onSubmit={handleSubmit} className="tool-settings-form">
          <div className="tool-settings-primary-grid">
            <div>
              <label className="form-field-label" htmlFor="wbs-template-file">模板文件 *</label>
              <input
                id="wbs-template-file"
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="form-field-control"
              />
            </div>
            <div>
              <label className="form-field-label" htmlFor="wbs-template-version">模板版本</label>
              <input
                id="wbs-template-version"
                type="text"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="例如 V2.0"
                className="form-field-control"
              />
            </div>
          </div>
          <div className="tool-settings-form-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={working}>
              {working ? "导入中…" : "导入并设为当前模板"}
            </button>
          </div>
        </form>

        {message && <p className="wbs-success">{message}</p>}
        {error && <p className="wbs-error">{error}</p>}
        {templates.length > 1 && <small className="entity-card-note">历史模板：{templates.filter((template) => template.status !== "active").map((template) => template.version).join("、")}</small>}
      </div>
    </section>
  );
}
