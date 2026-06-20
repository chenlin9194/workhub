"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { AiProvider } from "@/lib/types";
import {
  TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS, SOURCE_LABELS,
} from "@/lib/constants";

type Mode = "today" | "range";

interface NoteData {
  id: string; title: string; content: string; project: string | null;
  module: string | null; type: string; priority: string; status: string;
  owner: string | null; dueDate: string | null; source: string;
  tags: string | null; createdAt: string;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon.toISOString().split("T")[0], end: sun.toISOString().split("T")[0] };
}

function buildPrompt(notes: NoteData[], mode: Mode, startDate: string, endDate: string) {
  const renderNote = (i: number, n: NoteData) =>
    `### ${i}. ${n.title}
- 类型：${TYPE_LABELS[n.type] || n.type}
- 项目/版本：${n.project || "-"}
- 模块：${n.module || "-"}
- 优先级：${PRIORITY_LABELS[n.priority] || n.priority}
- 状态：${STATUS_LABELS[n.status] || n.status}
- 责任人：${n.owner || "-"}
- 截止时间：${n.dueDate || "-"}
- 标签：${n.tags || "-"}
- 来源：${SOURCE_LABELS[n.source] || n.source}
- 原始内容：${n.content}`;

  const notesMd = notes.map((n, i) => renderNote(i + 1, n)).join("\n\n");

  if (mode === "today") {
    return `以下是我今日 (${startDate}) 的所有工作记录（共 ${notes.length} 条），请帮我生成一份项目经理日报。

要求：
1. 不要编造记录中没有的信息
2. 所有结论必须来自下方记录
3. 重点识别：进展、风险、阻塞、决策、待办、需要升级的问题
4. 输出结构：今日核心进展、今日完成事项、推进中事项、新增风险、阻塞事项、关键决策、待跟进事项、明日重点
5. 语言简洁，适合手机 OS 软件项目经理日报

---

${notesMd}`;
  }

  return `以下是 ${startDate} ~ ${endDate} 期间的所有工作记录（共 ${notes.length} 条），请帮我生成一份项目经理周报。

要求：
1. 不要编造记录中没有的信息
2. 所有结论必须来自下方记录
3. 重点识别：本周进展、风险、阻塞、关键决策、跨团队依赖、下周计划
4. 输出结构：本周主要进展、本周完成事项、本周关键问题、风险与应对、关键决策、下周计划、需要上级关注
5. 语言简洁，适合手机 OS 软件项目经理周报

---

${notesMd}`;
}

export default function AiPage() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [mode, setMode] = useState<Mode>("today");
  const week = getWeekRange();
  const [startDate, setStartDate] = useState(week.start);
  const [endDate, setEndDate] = useState(week.end);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [noteCount, setNoteCount] = useState(0);
  const [usedModel, setUsedModel] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/ai-providers").then((r) => r.json()).then((data) => {
      setProviders(data);
      const def = data.find((p: AiProvider) => p.isDefault);
      if (def) setSelectedProvider(def.id);
      else if (data.length > 0) setSelectedProvider(data[0].id);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setError(""); setResult(""); setGenerating(true);
    try {
      // Fetch notes
      const params = new URLSearchParams({ pageSize: "500" });
      if (mode === "today") {
        const today = new Date().toISOString().split("T")[0];
        params.set("startDate", today);
        params.set("endDate", today);
      } else {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      }

      const notesRes = await fetch(`/api/notes?${params.toString()}`);
      if (!notesRes.ok) throw new Error("获取记录失败");
      const { notes } = await notesRes.json();
      setNoteCount(notes.length);

      if (notes.length === 0) {
        setError("所选时间范围内没有记录");
        setGenerating(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const prompt = buildPrompt(notes, mode, mode === "today" ? today : startDate, endDate);

      const aiRes = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProvider || undefined,
          prompt,
          systemPrompt: "你是一位资深手机 OS 软件项目经理的日报/周报撰写助手。请基于提供的工作记录生成专业的报告。使用 Markdown 格式输出。",
        }),
      });

      if (!aiRes.ok) {
        const d = await aiRes.json();
        throw new Error(d.error || "生成失败");
      }

      const data = await aiRes.json();
      setResult(data.content);
      setUsedModel(`${data.providerName} (${data.model})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>AI 助手</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            选择模型，一键生成日报/周报
          </p>
        </div>
        <Link href="/ai/settings" className="btn btn-ghost">
          <Icon name="settings" size={15} /> 模型配置
        </Link>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Model selector */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
              <Icon name="cpu" size={14} className="inline mr-1" style={{ verticalAlign: "middle" }} /> 选择模型
            </label>
            {providers.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                暂无配置。<Link href="/ai/settings" style={{ color: "var(--accent-blue)" }}>去添加模型 →</Link>
              </div>
            ) : (
              <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="input" style={{ maxWidth: 400 }}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.model}) {p.isDefault ? "★" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mode */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>生成类型</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setMode("today")}
                className={`btn btn-sm ${mode === "today" ? "btn-primary" : "btn-ghost"}`}
              >
                日报
              </button>
              <button
                onClick={() => setMode("range")}
                className={`btn btn-sm ${mode === "range" ? "btn-primary" : "btn-ghost"}`}
              >
                周报 / 自定义范围
              </button>
            </div>
          </div>

          {/* Date range */}
          {mode === "range" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" style={{ maxWidth: 180 }} />
              <span style={{ color: "var(--text-tertiary)" }}>~</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" style={{ maxWidth: 180 }} />
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || providers.length === 0}
            className="btn btn-purple btn-lg"
            style={{ alignSelf: "flex-start", opacity: generating ? 0.6 : 1 }}
          >
            <Icon name="sparkles" size={16} />
            {generating ? "AI 生成中..." : mode === "today" ? "生成日报" : "生成周报"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", background: "var(--accent-red-light)", color: "var(--accent-red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid var(--border-primary)",
          }}>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              基于 <strong style={{ color: "var(--text-secondary)" }}>{noteCount}</strong> 条记录生成 · {usedModel}
            </div>
            <button onClick={handleCopy} className="btn btn-ghost btn-sm">
              <Icon name="copy" size={14} /> {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 14, color: "var(--text-primary)", lineHeight: 1.8,
                whiteSpace: "pre-wrap", fontFamily: "-apple-system, sans-serif",
              }}
            >
              {result}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
