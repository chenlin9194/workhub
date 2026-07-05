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
    <section className="form-card action-item-draft-section">
      <div className="dashboard-section-title">
        <div>
          <span className="section-eyebrow">ACTION ITEMS</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="card action-item-draft-card">
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
          <div className="action-item-draft-list">
            {drafts.map((draft, index) => (
              <div key={index} className="card form-section action-item-draft-row">
                <div className="action-item-draft-fields">
                  <div>
                    <label className="action-item-draft-label">
                      标题
                    </label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => updateDraft(index, { title: e.target.value })}
                      placeholder="输入待办标题"
                      className="form-field-control"
                    />
                  </div>

                  <div className="action-item-draft-meta-grid">
                    <div>
                      <label className="action-item-draft-label">
                        状态
                      </label>
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft(index, { status: e.target.value })}
                        className="form-field-control"
                      >
                        {ACTION_ITEM_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="action-item-draft-label">
                        负责人
                      </label>
                      <input
                        type="text"
                        value={draft.owner}
                        onChange={(e) => updateDraft(index, { owner: e.target.value })}
                        placeholder="可选"
                        className="form-field-control"
                      />
                    </div>

                    <div>
                      <label className="action-item-draft-label">
                        截止日期
                      </label>
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(e) => updateDraft(index, { dueDate: e.target.value })}
                        className="form-field-control"
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
