"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MODULES, PRIORITIES, SOURCES, STATUSES, WORK_LOG_TYPES } from "@/lib/constants";
import { getLocalDateString } from "@/lib/utils";

type RelationMode = "none" | "existing" | "new";

interface ExistingItem {
  id: string;
  title: string;
}

function NewLogForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get("itemId") || "";

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExistingItem[]>([]);
  const [form, setForm] = useState({
    workDate: getLocalDateString(),
    title: "",
    content: "",
    type: "note",
    source: "manual",
    project: "",
    module: "",
    tags: "",
    relationMode: initialItemId ? ("existing" as RelationMode) : ("none" as RelationMode),
    itemId: initialItemId,
    newPriority: "P2",
    newStatus: "open",
    newOwner: "",
    newDueDate: "",
    newNextAction: "",
  });

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (initialItemId) {
      setForm((prev) => ({
        ...prev,
        relationMode: "existing",
        itemId: initialItemId,
      }));
    }
  }, [initialItemId]);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/items?pageSize=100");
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const removeCreatedItem = async (itemId: string) => {
    try {
      await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error rolling back created item:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert("标题和内容不能为空");
      return;
    }

    if (form.relationMode === "existing" && !form.itemId) {
      alert("请选择要关联的已有事项");
      return;
    }

    setLoading(true);
    let createdItemId: string | null = null;

    try {
      let itemIdToLink: string | null = null;

      if (form.relationMode === "new") {
        const itemRes = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(),
            project: form.project,
            module: form.module,
            type: form.type,
            tags: form.tags,
            priority: form.newPriority,
            status: form.newStatus,
            owner: form.newOwner,
            dueDate: form.newDueDate,
            nextAction: form.newNextAction,
          }),
        });

        if (!itemRes.ok) {
          const error = await itemRes.json();
          alert(error.error || "创建事项失败");
          return;
        }

        const item = await itemRes.json();
        createdItemId = item.id;
        itemIdToLink = item.id;
      } else if (form.relationMode === "existing") {
        itemIdToLink = form.itemId || null;
      }

      const logRes = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: form.workDate,
          title: form.title.trim(),
          content: form.content.trim(),
          type: form.type,
          source: form.source,
          project: form.project,
          module: form.module,
          tags: form.tags,
          itemId: itemIdToLink,
        }),
      });

      if (logRes.ok) {
        const log = await logRes.json();
        router.refresh();
        router.push(`/logs/${log.id}`);
        return;
      }

      if (createdItemId) {
        await removeCreatedItem(createdItemId);
      }

      const error = await logRes.json();
      alert(error.error || "创建日志失败");
    } catch (error) {
      console.error("Error creating log:", error);
      if (createdItemId) {
        await removeCreatedItem(createdItemId);
      }
      alert("创建日志失败");
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = form.relationMode === "new" ? "先创建事项并保存日志" : "创建日志";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>记录今日进展</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
        日志用于记录今天发生的事实。它可以不关联事项，也可以关联已有事项，或者先新建一个跟踪事项再一起保存。
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  工作日期 *
                </label>
                <input
                  type="date"
                  value={form.workDate}
                  onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  关联方式
                </label>
                <select
                  value={form.relationMode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      relationMode: e.target.value as RelationMode,
                      itemId: e.target.value === "existing" ? prev.itemId : "",
                    }))
                  }
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  <option value="none">不关联事项</option>
                  <option value="existing">关联已有事项</option>
                  <option value="new">创建新事项并关联</option>
                </select>
              </div>
            </div>

            {form.relationMode === "existing" && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  选择已有事项
                </label>
                <select
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                  disabled={items.length === 0}
                >
                  <option value="">{items.length === 0 ? "当前没有可关联事项" : "请选择已有事项"}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.relationMode === "new" && (
              <div className="card" style={{ padding: 16, background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>新事项信息</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      新事项将直接继承本条日志的标题、项目、模块、类型和标签，用于跟踪需要闭环的风险、问题、待办或跨团队依赖。
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        优先级
                      </label>
                      <select
                        value={form.newPriority}
                        onChange={(e) => setForm({ ...form, newPriority: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        状态
                      </label>
                      <select
                        value={form.newStatus}
                        onChange={(e) => setForm({ ...form, newStatus: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      >
                        {STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        负责人
                      </label>
                      <input
                        type="text"
                        value={form.newOwner}
                        onChange={(e) => setForm({ ...form, newOwner: e.target.value })}
                        placeholder="可选"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                        截止日期
                      </label>
                      <input
                        type="date"
                        value={form.newDueDate}
                        onChange={(e) => setForm({ ...form, newDueDate: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                      下一步行动
                    </label>
                    <textarea
                      value={form.newNextAction}
                      onChange={(e) => setForm({ ...form, newNextAction: e.target.value })}
                      placeholder="可选"
                      rows={3}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                标题 *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="输入日志标题，新事项会继承这个标题"
                required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                内容 *
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="输入日志内容"
                rows={8}
                required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  类型
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {WORK_LOG_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  来源
                </label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  {SOURCES.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  模块
                </label>
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                >
                  <option value="">选择模块</option>
                  {MODULES.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  项目
                </label>
                <input
                  type="text"
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  placeholder="所属项目"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                  标签
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="标签，用逗号分隔"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                取消
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? "创建中..." : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewLogPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>加载中...</div>}>
      <NewLogForm />
    </Suspense>
  );
}
