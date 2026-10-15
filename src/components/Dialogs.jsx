import { useEffect, useRef } from "react";
import {
  X,
  ArrowUpRight,
  Bookmark,
  ExternalLink,
  Check,
  RotateCcw,
  Clock3,
} from "lucide-react";
import { copy, bilingual, categoryName, dateTime } from "../lib/format";
import { priorityBand } from "../lib/attention";
import BriefingNotes, { ReadingText } from "./BriefingNotes";
import { sectionName } from "../lib/sections";
function Text({ value, language, className = "" }) {
  return <ReadingText value={value} language={language} className={className} />;
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const surfaces = [...document.querySelectorAll(".main-workspace,.sidebar")];
    const priorInert = surfaces.map((el) => el.inert);
    surfaces.forEach((el) => {
      el.inert = true;
    });
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current.querySelectorAll(
          'button,a[href],input,select,[tabindex="0"]',
        );
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = old;
      surfaces.forEach((el, i) => {
        el.inert = priorInert[i];
      });
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-top">
          <span>MERIDIAN / {title}</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close details"
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function ArticleDialog({
  article: a,
  background,
  readingSection,
  demo = false,
  language,
  onClose,
  saved,
  pending,
  onSave,
  onRead,
  readPending,
  onRequestAnalysis,
  requestPending,
  requested,
}) {
  return (
    <Modal
      title={copy("Story context", "报道背景", language)}
      onClose={onClose}
    >
      <div className="detail-meta">
        {readingSection ? sectionName(readingSection, language) : categoryName(a.category, language)}{" "}
        <span>
          · {a.sourceName} · {dateTime(a.publishedAt)}
        </span>
      </div>
      <h2>{a.title}</h2>
      <div className="detail-actions">
        <a
          className="primary-button"
          href={a.url}
          target="_blank"
          rel="noreferrer"
        >
          {demo
            ? copy("Example reference", "示例链接", language)
            : copy("Read original report", "阅读原文", language)}
          <ArrowUpRight size={16} />
        </a>
        <button
          className="secondary-button"
          onClick={onSave}
          disabled={pending}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          {saved
            ? copy("Saved", "已收藏", language)
            : copy("Save story", "收藏报道", language)}
        </button>
        <button
          className="secondary-button"
          disabled={readPending}
          onClick={onRead}
        >
          {a.isRead ? <RotateCcw size={16} /> : <Check size={16} />}{" "}
          {a.isRead
            ? copy("Mark unread", "标为未读", language)
            : copy("Mark read", "标为已读", language)}
        </button>
        {a.analysis && (a.isReviewedSnapshot || a.attention?.needsReview || requested) ? (
          <button
            className="secondary-button"
            onClick={onRequestAnalysis}
            disabled={requested || requestPending}
          >
            {requested
              ? copy("Review queued", "复核已排队", language)
              : copy("Request review", "请求复核", language)}
          </button>
        ) : null}
      </div>
      {a.analysis ? <section className="detail-section context-primer">
        <h3>{copy("Start here · the background", "先看背景", language)}</h3>
        <Text value={background || a.analysis.context} language={language} />
      </section> : null}
      {a.attention ? (
        <details className="detail-attention">
          <summary>{copy("Why this stays on your dashboard", "为何在首页保留", language)}</summary>
          <div className="priority-meta">
            <strong>
              {copy(
                priorityBand(a.attention.importance).en,
                priorityBand(a.attention.importance).zh,
                language,
              )}{" "}
              · {a.attention.importance}/100
            </strong>
            <span>
              {a.isRead
                ? copy("Read", "已读", language)
                : a.attention.heldUntilRead
                  ? copy("Held until read", "保留至已读", language)
                  : copy("Time-limited context", "有时限的背景信息", language)}
            </span>
          </div>
          <Text value={a.attention.reason} language={language} />
          <small>
            {copy("Priority reviewed", "优先级复核于", language)}{" "}
            {dateTime(a.attention.reviewedAt)} ·{" "}
            {copy("Review horizon", "复核期限", language)}{" "}
            {a.attention.horizonDays} {copy("days", "天", language)}.{" "}
            {copy(
              "Importance is an editorial judgment, not a truth or probability score.",
              "重要性是编辑判断，并非真实性或概率评分。",
              language,
            )}
          </small>
          {a.attention.needsReview ? (
            <p className="inline-note">
              {copy(
                "Review due. This event remains visible because it is important and unread; retention does not mean its latest facts are verified.",
                "需要复核。此事件因重要且未读而继续保留；保留并不表示最新情况已经核实。",
                language,
              )}
            </p>
          ) : null}
        </details>
      ) : null}
      <section className="detail-section">
        <h3>
          {a.analysis
            ? demo
              ? copy("Example summary · fictional", "示例摘要 · 虚构", language)
              : copy("The latest reported development", "最新报道进展", language)
            : copy(
                a.summaryProvenance?.kind === "headline_translation"
                  ? "Publisher headline · translated"
                  : "Publisher excerpt · translated, not analyzed",
                a.summaryProvenance?.kind === "headline_translation"
                  ? "发布者标题 · 翻译"
                  : "发布者摘要 · 翻译，尚未分析",
                language,
              )}
        </h3>
        <Text value={a.summary || a.excerpt} language={language} />
      </section>
      {a.analysis ? (
        <>
          {a.isReviewedSnapshot || a.analysis.isStale ? (
            <p className="inline-note">
              {copy(
                "This is the last reviewed version. Source content has changed; check the evidence and queue a review.",
                "这是上次已核验的版本，来源内容已变化；请查看证据并请求复核。",
                language,
              )}
            </p>
          ) : null}
          {[
            ...(background ? [["context", "More reported background", "更多报道背景"]] : []),
            [
              "implications",
              "Why it matters · interpretation",
              "为何重要 · 解读",
            ],
            ["uncertainty", "What remains uncertain", "仍不确定的事项"],
            ["watch", "What to watch next", "后续观察"],
          ].map(([key, en, zh]) => (
            <section className="detail-section" key={key}>
              <h3>{copy(en, zh, language)}</h3>
              <Text value={a.analysis[key]} language={language} />
            </section>
          ))}
          <section className="detail-section">
            <h3>
              {copy("Evidence & further reading", "证据与延伸阅读", language)}
            </h3>
            <ul className="evidence-list">
              {a.analysis.evidence?.map((e, i) => (
                <li key={i}>
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.label}
                    <ExternalLink size={14} />
                  </a>
                </li>
              ))}
            </ul>
            <small>
              {demo
                ? copy("Example generated", "示例生成于", language)
                : copy(
                    "Codex analysis prepared",
                    "Codex 分析生成于",
                    language,
                  )}{" "}
              {dateTime(a.analysis.analyzedAt)}
            </small>
          </section>
        </>
      ) : (
        <div className="analysis-pending">
          <h3>
            {requested
              ? copy("Analysis queued.", "分析已排队。", language)
              : copy("Not yet analyzed.", "尚未分析。", language)}
          </h3>
          <p>
            {copy(
              requested
                ? "Your request is saved for the next Codex analysis run. Translation and researched analysis have separate completion states."
                : "This source summary has not been independently analyzed. Queue it if it deserves attention; the next Codex run prioritizes your requests and ongoing major events.",
              requested
                ? "你的请求已保存，等待下一次 Codex 分析任务。翻译与深入分析分别记录完成状态。"
                : "此来源摘要尚未完成独立分析。如值得关注，可加入分析队列；下一次 Codex 任务会优先处理你的请求与持续重大事件。",
              language,
            )}
          </p>
          <button
            className="primary-button queue-analysis"
            onClick={onRequestAnalysis}
            disabled={requested || requestPending}
          >
            {requested ? <Clock3 size={16} /> : null}
            {requested
              ? copy(
                  "Queued for next Codex run",
                  "已排入下一次 Codex 任务",
                  language,
                )
              : copy("Queue analysis", "请求分析", language)}
          </button>
        </div>
      )}
    </Modal>
  );
}
export function BriefingDialog({ data, context, language, onClose, onOpen }) {
  return <Modal title={copy("Reading brief", "阅读简报", language)} onClose={onClose}>
    <div className="detail-meta">{context.articles.length} {context.view === 'briefing' ? copy(context.articles.length === 1 ? "priority event in view" : "priority events in view", "个当前范围内的重点事件", language) : copy("reports in this view", "篇当前范围内的报道", language)} · EN / 中文</div>
    <h2>{bilingual(context.heading, language)}</h2>
    <BriefingNotes context={context} data={data} language={language} onOpen={onOpen} />
    {context.reviewedAt ? <small className="rail-timestamp">{copy("Based on research from", "依据此时核查的报道", language)} {dateTime(context.reviewedAt)}</small> : null}
  </Modal>;
}
