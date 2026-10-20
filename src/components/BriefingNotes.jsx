import { ArrowUpRight } from 'lucide-react';
import { copy, bilingual, dateTime } from '../lib/format';
import { articleForReview } from '../lib/attention';
import { firstParagraph } from '../lib/editorial';

export function ReadingText({ value, language, className = '' }) {
  const languages = typeof value === 'string' ? ['en'] : language === 'both' ? ['en', 'zh'] : [language];
  return languages.map(lang => {
    const text = typeof value === 'string' ? value : value?.[lang];
    if (!text) return null;
    return <div key={lang} className={`reading-language ${lang === 'zh' ? 'is-chinese' : ''} ${className}`} lang={lang === 'zh' ? 'zh-Hans' : 'en'}>
      {language === 'both' ? <span className="reading-language-label" aria-hidden="true">{lang === 'en' ? 'EN' : '中文'}</span> : null}
      {text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </div>;
  });
}

export default function BriefingNotes({ context, data, language, onOpen, compact = false }) {
  if (!context.notes.length) return <div className="notes-empty">
    <p>{context.view === 'saved' && !context.articles.length
      ? copy('No saved stories.', '暂无收藏。', language)
      : !context.articles.length
        ? copy('No matching stories.', '暂无匹配报道。', language)
        : copy('Notes pending.', '简报待更新。', language)}</p>
  </div>;
  return <div className={`section-notes ${compact ? 'section-notes-compact' : ''}`} data-note-scope={`${context.view}:${context.category}`}>
    {context.notes.slice(0, compact ? 2 : 3).map(note => {
      // An English reading brief does not replace the existing Chinese facts.
      const narrative = language === 'zh' && !note.narrative?.zh ? null : note.narrative;
      const opening = narrative || note.summary;
      return <section className="briefing-note" key={`${note.articleIds.join(':')}:${note.title.en}`}>
      <h3>{bilingual(note.title, language)}</h3>
      {language === 'both' && note.title.zh && note.title.zh !== note.title.en ? <p className="note-title-zh" lang="zh-Hans">{note.title.zh}</p> : null}
      <div className={`note-development ${narrative ? 'note-reader-brief' : ''}`}>
        {!narrative && !compact ? <h4>{note.kind === 'source' ? copy('Source summary', '来源摘要', language) : copy('What changed', '最新进展', language)}</h4> : null}
        <ReadingText value={compact ? firstParagraph(opening) : opening} language={language} />
      </div>
      {!compact && note.background ? <details className="note-background note-disclosure">
        <summary>{copy('Background', '背景', language)}</summary>
        <ReadingText value={note.background} language={language} />
      </details> : null}
      {!compact && !narrative && note.insights?.length ? <div className="note-insights">
        <div className="insight-heading">
          <h4>{copy('Our read', '解读与启示', language)}</h4>
        </div>
        <p className="insight-label">{copy('Editorial judgment', '编辑判断', language)}</p>
        {note.insights.map(insight => {
          const article = articleForReview(data, insight.articleId);
          return <div className="note-insight" key={insight.articleId}>
            {note.insights.length > 1 ? <h5>{bilingual(insight.title, language)}</h5> : null}
            <ReadingText value={firstParagraph(insight.text)} language={language} />
            <div className="insight-meta">
              {insight.reviewedAt ? <span>{copy('Checked', '核查于', language)} <time lang="en" dateTime={insight.reviewedAt}>{dateTime(insight.reviewedAt)}</time></span> : null}
              {insight.needsReview ? <span className="insight-review-due">{copy('Review due', '待复核', language)}</span> : null}
            </div>
            {article ? <button className="insight-read-more" onClick={() => onOpen(article)} aria-label={`${copy('Read analysis and evidence', '阅读完整解读与证据', language)}: ${article.title}`}>
              {copy('Full analysis & sources', '完整分析与来源', language)}<ArrowUpRight size={12}/>
            </button> : null}
          </div>;
        })}
      </div> : null}
      <div className="note-context-row">
        <span>{data.collection?.kind === 'synthetic_demo' ? copy('Fictional example', '虚构示例', language) : note.kind === 'source' ? copy('Source summary · unreviewed', '来源摘要 · 未分析', language) : copy('Reviewed', '已核查', language)}</span>
        {note.reviewedAt ? <time lang="en" dateTime={note.reviewedAt}>{dateTime(note.reviewedAt)}</time> : null}
        {note.needsReview ? <span className="note-review-due">{copy('Review due · newer developments unchecked', '待复核 · 新进展尚未核实', language)}</span> : null}
        {note.articleIds.map((id, index) => {
          const article = articleForReview(data, id);
          return article ? <button key={id} onClick={() => onOpen(article)} aria-label={`${copy('Read context', '查看背景', language)}: ${article.title}`}>
            {copy('Analysis & sources', '分析与来源', language)}{note.articleIds.length > 1 ? ` ${index + 1}` : ''}<ArrowUpRight size={12}/>
          </button> : null;
        })}
      </div>
    </section>;})}
  </div>;
}
