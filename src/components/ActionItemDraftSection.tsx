"use client";

import { ACTION_ITEM_STATUSES } from "@/lib/constants";
import type { ActionItemDraft } from "@/lib/types";

export function createActionItemDraft(): ActionItemDraft {
  return {
    title: "",
    status: "pending",
    owner: "",
    dueDate: "",
  };
}

type ActionItemDraftSectionProps = {
  enabled: boolean;
  drafts: ActionItemDraft[];
  onEnabledChange: (enabled: boolean) => void;
  onDraftsChange: (drafts: ActionItemDraft[]) => void;
  title?: string;
  description?: string;
};

export default function ActionItemDraftSection({
  enabled,
  drafts,
  onEnabledChange,
  onDraftsChange,
  title = "Action Items",
  description = "Optional: create a few contextual action items after saving the parent record.",
}: ActionItemDraftSectionProps) {
  const updateDraft = (index: number, patch: Partial<ActionItemDraft>) => {
    onDraftsChange(
      drafts.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft))
    );
  };

  const addDraft = () => {
    onDraftsChange([...drafts, createActionItemDraft()]);
  };

  const removeDraft = (index: number) => {
    onDraftsChange(drafts.filter((_, draftIndex) => draftIndex !== index));
  };

  return (
    <section className="form-card" style={{ marginBottom: 24 }}>
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">ACTION ITEMS</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              const nextEnabled = e.target.checked;
              onEnabledChange(nextEnabled);
              if (nextEnabled && drafts.length === 0) {
                onDraftsChange([createActionItemDraft()]);
              }
            }}
          />
          启用 Action Items
        </label>

        <p className="field-help">{description}</p>

        {enabled && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {drafts.map((draft, index) => (
              <div
                key={index}
                className="card form-section"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                      标题
                    </label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => updateDraft(index, { title: e.target.value })}
                      placeholder="输入待办标题"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 14,
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                        状态
                      </label>
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft(index, { status: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-secondary)",
                          color: "var(--text-primary)",
                          fontSize: 14,
                        }}
                      >
                        {ACTION_ITEM_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                        负责人
                      </label>
                      <input
                        type="text"
                        value={draft.owner}
                        onChange={(e) => updateDraft(index, { owner: e.target.value })}
                        placeholder="可选"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-secondary)",
                          color: "var(--text-primary)",
                          fontSize: 14,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                        截止日期
                      </label>
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(e) => updateDraft(index, { dueDate: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-secondary)",
                          color: "var(--text-primary)",
                          fontSize: 14,
                        }}
                      />
                    </div>
                  </div>

                  <div className="field-actions">
                    <span className="field-note">保存父记录后批量创建。</span>
                    <button type="button" onClick={() => removeDraft(index)} className="btn btn-secondary btn-sm">
                      删除本条
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="field-actions">
              <button type="button" onClick={addDraft} className="btn btn-secondary">
                添加一条
              </button>
              <span className="field-note">空标题不会提交。</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
