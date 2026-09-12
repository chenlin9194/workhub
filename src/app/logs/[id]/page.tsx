"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { WORK_LOG_TYPE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { generateWorkLogMarkdown, splitCommaSeparatedText } from "@/lib/utils";
import AutoLinkText from "@/components/AutoLinkText";
import PageLoadingState from "@/components/PageLoadingState";
import { getProjectDisplayName } from "@/lib/projectDisplay";

interface WorkLog {
  id: string;
  workDate: string;
  title: string;
  content: string;
  type: string;
  source: string;
  project?: string | null;
  projectId?: string | null;
  projectRef?: { name: string } | null;
  module?: string | null;
  tags?: string | null;
  itemId?: string | null;
  item?: { id: string; title: string } | null;
  reportable: boolean;
  sourceUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function LogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [log, setLog] = useState<WorkLog | null>(null);
  const [loading, setLoading] = useState(true);
  const deleteInFlightRef = useRef(false);
  const [deleting, setDeleting] = useState(false);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/logs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLog(data);
      } else {
        alert("日志不存在");
        router.push("/logs");
      }
    } catch (error) {
      console.error("Error fetching log:", error);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!log || deleteInFlightRef.current) return;
    if (!confirm("确定删除此日志？")) return;

    const button = e.currentTarget;
    deleteInFlightRef.current = true;
    button.disabled = true;
    button.textContent = "删除中...";
    setDeleting(true);
    let shouldRestoreButton = true;

    try {
      const res = await fetch(`/api/logs/${log.id}`, { method: "DELETE" });
      if (res.ok) {
        shouldRestoreButton = false;
        window.location.assign("/logs");
        return;
      } else {
        alert("删除失败，请重试");
      }
    } catch (error) {
      console.error("Error deleting log:", error);
    } finally {
      if (shouldRestoreButton) {
        deleteInFlightRef.current = false;
        button.disabled = false;
        button.textContent = "删除";
        setDeleting(false);
      }
    }
  };

  const copyMarkdown = () => {
    if (!log) return;
    const md = generateWorkLogMarkdown(log);
    navigator.clipboard.writeText(md);
    alert("已复制到剪贴板");
  };

  if (loading) {
    return (
      <PageLoadingState
        title="加载日志详情..."
        description="正在读取日志正文、关联事项和后续动作。"
        rows={5}
      />
    );
  }

  if (!log) return null;

  const tags = splitCommaSeparatedText(log.tags);
  const projectName = getProjectDisplayName({ relationName: log.projectRef?.name, legacyName: log.project });

  return (
    <div className="detail-page detail-page--log log-detail-evidence-page">
      <header className="card detail-header">
        <div className="detail-header-main">
          <Link href="/logs" className="detail-back-link">
            <Icon name="arrow-left" size={14} />
            返回列表
          </Link>
          <div className="detail-title-row">
            <span className="section-eyebrow">WORK LOG</span>
            <h1 className="detail-title">{log.title}</h1>
          </div>
          <div className="detail-status-row">
            <span className={`badge badge-${log.type}`}>
              {WORK_LOG_TYPE_LABELS[log.type] || log.type}
            </span>
            <span className="entity-pill entity-pill--muted">{log.workDate}</span>
            <span className="entity-pill entity-pill--muted">
              {SOURCE_LABELS[log.source] || log.source}
            </span>
            <span className={`badge ${log.reportable ? "badge-reportable" : "badge-other"}`}>
              {log.reportable ? "可汇报" : "不可汇报"}
            </span>
          </div>
        </div>
        <div className="detail-actions">
          <button onClick={copyMarkdown} className="btn btn-secondary">
            <Icon name="copy" size={14} />
            复制 Markdown
          </button>
          <Link href={`/logs/${log.id}/edit`} className="btn btn-secondary">
            <Icon name="edit" size={14} />
            编辑
          </Link>
          <button onClick={handleDelete} className="btn btn-danger" disabled={deleting}>
            {deleting ? (
              "删除中..."
            ) : (
              <>
                <Icon name="trash" size={14} />
                删除
              </>
            )}
          </button>
        </div>
      </header>

      <div className="log-detail-layout">
        <main className="log-detail-primary">
          <div className="card detail-main-card log-evidence-body-card">
            <div className="detail-copy-block">
              <div className="detail-field-label">事实正文</div>
              <div className="detail-body-text detail-body-text--prewrap log-evidence-body">
                <AutoLinkText text={log.content} />
              </div>
            </div>
          </div>

        </main>

        <aside className="log-detail-sidebar">
          <section className="card log-context-card">
            <div className="log-context-card-head">
              <span className="section-eyebrow">CONTEXT</span>
              <h2>关联上下文</h2>
            </div>
            <div className="log-context-list">
              <div>
                <span>项目</span>
                <strong>{projectName}</strong>
              </div>
              <div>
                <span>关联事项</span>
                {log.item ? <Link href={`/items/${log.item.id}`}>{log.item.title}</Link> : <strong>未关联事项</strong>}
              </div>
              <div>
                <span>模块</span>
                <strong>{log.module || "未标记"}</strong>
              </div>
            </div>
          </section>

          <section className="card log-context-card">
            <div className="log-context-card-head">
              <span className="section-eyebrow">ATTRIBUTES</span>
              <h2>记录属性</h2>
            </div>
            <div className="log-context-list">
              <div>
                <span>类型</span>
                <strong>{WORK_LOG_TYPE_LABELS[log.type] || log.type}</strong>
              </div>
              <div>
                <span>来源</span>
                <strong>{SOURCE_LABELS[log.source] || log.source}</strong>
              </div>
              <div>
                <span>工作日期</span>
                <strong>{log.workDate}</strong>
              </div>
              <div>
                <span>汇报状态</span>
                <strong>{log.reportable ? "可汇报" : "不可汇报"}</strong>
              </div>
              <div>
                <span>创建时间</span>
                <strong>{new Date(log.createdAt).toLocaleString("zh-CN")}</strong>
              </div>
            </div>
          </section>

          <section className="card log-context-card">
            <div className="log-context-card-head">
              <span className="section-eyebrow">EVIDENCE</span>
              <h2>来源证据</h2>
            </div>
            <div className="log-context-list">
              <div>
                <span>来源链接</span>
                {log.sourceUrl ? (
                  <a href={log.sourceUrl} target="_blank" rel="noopener noreferrer">
                    打开来源链接
                  </a>
                ) : (
                  <strong>暂无</strong>
                )}
              </div>
              <div>
                <span>标签</span>
                {tags.length > 0 ? (
                  <div className="detail-tag-row log-context-tags">
                    {tags.map((tag) => (
                      <span key={tag} className="entity-pill entity-pill--muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <strong>暂无</strong>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
