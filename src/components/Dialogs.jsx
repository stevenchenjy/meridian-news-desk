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
import { articleReaderBrief, articleReviewDue, editorialHeadline, editorialHeadlines, reviewedEditorial } from "../lib/editorial";
import BriefingNotes, { ReadingText } from "./BriefingNotes";
import { sectionName } from "../lib/sections";
import { BackgroundLinks } from "./BackgroundLibrary";
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
        const els = [...ref.current.querySelectorAll(
          'button,a[href],input,select,summary,[tabindex="0"]',
        )].filter(el => !el.disabled && el.getClientRects().length > 0);
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
  backgroundGuides = [],
  onOpenBackground,
}) {
  const reviewed = reviewedEditorial(a);
  const readerBrief = articleReaderBrief(a);
  const narrative = language === 'zh' && !readerBrief?.zh ? null : readerBrief;
  const headlines = editorialHeadlines(a);
  const reviewDue = reviewed && articleReviewDue(a);
  return (
    <Modal title={reviewed ? copy("Story analysis", "报道解读", language) : copy("Source report", "来源报道", language)} onClose={onClose}>
      <div className="detail-meta">
        {readingSection ? sectionName(readingSection, language) : categoryName(a.category, language)}
        <span> · {a.sourceName} · {dateTime(a.publishedAt)}</span>
      </div>
      <h2>{editorialHeadline(a, language)}</h2>
      {language === 'both' && headlines.zh && headlines.zh !== headlines.en ? <p className="detail-headline-zh" lang="zh-Hans">{headlines.zh}</p> : null}
      <p className="publisher-headline">
        <span>{copy('Publisher headline', '原文标题', language)}</span>
        <a href={a.url} target="_blank" rel="noreferrer">{a.title}<ArrowUpRight size={13} /></a>
      </p>
      <div className="detail-actions">
        <a className="primary-button" href={a.url} target="_blank" rel="noreferrer">
          {demo ? copy("Example reference", "示例链接", language) : copy("Read original", "阅读原文", language)}<ArrowUpRight size={16} />
        </a>
        <button className="secondary-button" onClick={onSave} disabled={pending}>
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />{saved ? copy("Saved", "已收藏", language) : copy("Save", "收藏", language)}
        </button>
        <button className="secondary-button" disabled={readPending} onClick={onRead}>
          {a.isRead ? <RotateCcw size={16} /> : <Check size={16} />}{a.isRead ? copy("Mark unread", "标为未读", language) : copy("Mark read", "标为已读", language)}
        </button>
        {reviewed && (reviewDue || requested) ? <button className="secondary-button" onClick={onRequestAnalysis} disabled={requested || requestPending}>
          {requested ? copy("Review queued", "复核已排队", language) : copy("Request review", "请求复核", language)}
        </button> : null}
        {reviewed ? <a className="detail-evidence-jump" href={`#evidence-${a.id}`}>{copy('Sources', '来源', language)} ({a.analysis.evidence.length})</a> : null}
      </div>
      {reviewed ? <div className="detail-review-status">
        <span>{demo ? copy('Fictional example', '虚构示例', language) : copy('Meridian analysis', 'Meridian 解读', language)} · {copy('Checked', '核查于', language)} <time lang="en" dateTime={a.analysis.analyzedAt}>{dateTime(a.analysis.analyzedAt)}</time></span>
        {reviewDue ? <p className="inline-note">{copy('This is the last reviewed assessment. Newer developments await review.', '此处保留上次核查的判断，更新的进展仍待复核。', language)}</p> : null}
      </div> : null}
      {narrative ? <section className="detail-section detail-reader-brief" aria-label={copy('The read', '简明解读', language)}>
        <Text value={narrative} language={language} />
      </section> : <section className="detail-section detail-reader-brief">
        <h3>{reviewed ? copy('What changed', '最新进展', language) : copy(a.summaryProvenance?.kind === 'headline_translation' ? 'Translated headline · unreviewed' : 'Source excerpt · unreviewed', a.summaryProvenance?.kind === 'headline_translation' ? '标题翻译 · 未分析' : '来源摘要 · 未分析', language)}</h3>
        <Text value={a.summary || a.excerpt} language={language} />
      </section>}
      {reviewed ? <>
        {narrative ? <details className="detail-section detail-disclosure">
          <summary>{copy('Reviewed facts', '已核查事实', language)}</summary>
          <Text value={a.summary} language={language} />
        </details> : null}
        <details className="detail-section detail-disclosure context-primer">
          <summary>{copy('Background', '背景', language)}</summary>
          <Text value={background || a.analysis.context} language={language} />
          {background && (background.en !== a.analysis.context.en || background.zh !== a.analysis.context.zh) ? <Text value={a.analysis.context} language={language} /> : null}
        </details>
        <BackgroundLinks guides={backgroundGuides} language={language} onOpen={onOpenBackground} />
        {[
          ['implications', 'Our full analysis', '完整解读'],
          ['uncertainty', 'What remains uncertain', '尚待确认'],
          ['watch', 'What to watch next', '后续观察'],
        ].map(([key, en, zh]) => <details className={`detail-section detail-disclosure ${key === 'implications' ? 'detail-insight' : ''}`} key={key}>
          <summary>{copy(en, zh, language)}</summary>
          {key === 'implications' ? <p className="insight-label">{copy('Editorial judgment, grounded in the evidence below.', '基于下列证据的编辑判断。', language)}</p> : null}
          <Text value={a.analysis[key]} language={language} />
        </details>)}
        <details className="detail-section detail-disclosure detail-evidence" id={`evidence-${a.id}`} open>
          <summary>{copy('Sources & evidence', '来源与证据', language)} <span>({a.analysis.evidence.length})</span></summary>
          <ul className="evidence-list">{a.analysis.evidence.map((e, i) => <li key={`${e.url}:${i}`}><a href={e.url} target="_blank" rel="noreferrer">{e.label}<ExternalLink size={14} /></a></li>)}</ul>
          <small>{copy('Checked', '核查于', language)} <time lang="en" dateTime={a.analysis.analyzedAt}>{dateTime(a.analysis.analyzedAt)}</time></small>
        </details>
      </> : <>
        <BackgroundLinks guides={backgroundGuides} language={language} onOpen={onOpenBackground} />
        <div className="analysis-pending">
          <h3>{requested ? copy('Analysis queued', '分析已排队', language) : copy('Not yet analyzed', '尚未分析', language)}</h3>
          <p>{copy(requested ? 'Saved for the next run.' : 'Queue this report for independent analysis.', requested ? '已保存，等待下次任务。' : '可将此报道加入独立分析队列。', language)}</p>
          <button className="primary-button queue-analysis" onClick={onRequestAnalysis} disabled={requested || requestPending}>
            {requested ? <Clock3 size={16} /> : null}{requested ? copy('Queued', '已排队', language) : copy('Queue analysis', '请求分析', language)}
          </button>
        </div>
      </>}
      {a.attention ? <details className="detail-attention detail-section">
        <summary>{copy('Why this is on the agenda', '为何列入重点', language)}</summary>
        <div className="priority-meta"><strong>{copy(priorityBand(a.attention.importance).en, priorityBand(a.attention.importance).zh, language)} · {a.attention.importance}/100</strong><span>{a.isRead ? copy('Read', '已读', language) : a.attention.heldUntilRead ? copy('Held until read', '保留至已读', language) : copy('Review scheduled', '定期复核', language)}</span></div>
        <Text value={a.attention.reason} language={language} />
        <small>{copy('Reviewed', '复核于', language)} {dateTime(a.attention.reviewedAt)} · {copy('Review window', '复核期限', language)} {a.attention.horizonDays} {copy('days', '天', language)}. {copy('Editorial importance, not a truth or probability score.', '编辑重要性评分，非真实性或概率评分。', language)}</small>
        {a.attention.needsReview ? <p className="inline-note">{copy('Review due · latest developments unchecked.', '待复核 · 最新进展尚未核实。', language)}</p> : null}
      </details> : null}
    </Modal>
  );
}

export function BriefingDialog({ data, context, language, onClose, onOpen }) {
  return <Modal title={copy("Daily edition", "每日简报", language)} onClose={onClose}>
    <div className="detail-meta">{context.articles.length} {context.view === 'briefing' ? copy(context.articles.length === 1 ? "event" : "events", "个事件", language) : copy("reports", "篇报道", language)}</div>
    <h2>{bilingual(context.overview ? data.briefing.title : context.heading, language)}</h2>
    <p className="edition-caption">{context.editionAt ? dateTime(context.editionAt) : ''} · {context.readingMinutes || 1} {copy('min read', '分钟阅读', language)}</p>
    {context.overview ? <section className="edition-overview"><ReadingText value={context.overview} language={language} />{context.overviewIsStale ? <p className="inline-note">{copy('Earlier overview · current collection awaits review.', '此为先前概述，当前收集的进展仍待核查。', language)}</p> : null}</section> : null}
    <BriefingNotes context={context} data={data} language={language} onOpen={onOpen} />
    {context.reviewedAt ? <small className="rail-timestamp">{copy("Reviewed", "核查于", language)} {dateTime(context.reviewedAt)}</small> : null}
  </Modal>;
}
