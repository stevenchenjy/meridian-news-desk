import { ArrowUpRight } from 'lucide-react';
import { copy, bilingual } from '../lib/format';
import { articleForReview } from '../lib/attention';

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

export default function BriefingNotes({ context, data, language, onOpen }) {
  if (!context.notes.length) return <div className="notes-empty">
    <p>{context.view === 'saved' && !context.articles.length
      ? copy('Save a story to build your own reading brief.', '收藏报道后，这里会整理你的阅读重点。', language)
      : !context.articles.length
        ? copy('No stories match this selection.', '当前筛选下还没有报道。', language)
        : copy('Bilingual notes are not ready for these reports yet.', '这些报道的双语简报尚未准备完成。', language)}</p>
  </div>;
  return <div className="section-notes" data-note-scope={`${context.view}:${context.category}`}>
    {context.notes.map(note => <section className="briefing-note" key={`${note.articleIds.join(':')}:${note.title.en}`}>
      <h3>{bilingual(note.title, language)}</h3>
      {language === 'both' && note.title.zh !== note.title.en ? <p className="note-title-zh" lang="zh-Hans">{note.title.zh}</p> : null}
      {note.background ? <div className="note-background">
        <h4>{copy('Start here', '先看背景', language)}</h4>
        <ReadingText value={note.background} language={language} />
      </div> : null}
      <div className="note-development">
        <h4>{note.kind === 'source' ? copy('From the report', '来源报道', language) : copy('The development', '最新进展', language)}</h4>
        <ReadingText value={note.summary} language={language} />
      </div>
      <div className="note-context-row">
        <span>{data.collection?.kind === 'synthetic_demo' ? copy('Fictional example', '虚构示例', language) : note.kind === 'source' ? copy('Source summary · not analyzed', '来源摘要 · 尚未分析', language) : copy('Reviewed reporting', '已核查报道', language)}</span>
        {note.needsReview ? <span className="note-review-due">{copy('Review due', '待复核', language)}</span> : null}
        {note.articleIds.map((id, index) => {
          const article = articleForReview(data, id);
          return article ? <button key={id} onClick={() => onOpen(article)} aria-label={`${copy('Read context', '查看背景', language)}: ${article.title}`}>
            {copy('Context', '背景', language)}{note.articleIds.length > 1 ? ` ${index + 1}` : ''}<ArrowUpRight size={12}/>
          </button> : null;
        })}
      </div>
    </section>)}
  </div>;
}
