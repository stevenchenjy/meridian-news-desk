import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Search } from 'lucide-react';
import { bilingual, copy, dateTime } from '../lib/format';
import { filterBackgroundGuides, matchingBackgroundGuides } from '../lib/background';
import { ReadingText } from './BriefingNotes';
import { readingSections } from '../lib/sections';

function DualLabel({ value, language, className = '' }) {
  return <span className={`background-label ${className}`}>
    <span lang={language === 'zh' ? 'zh-Hans' : 'en'}>{bilingual(value, language)}</span>
    {language === 'both' && value.zh ? <span className="background-label-zh" lang="zh-Hans">{value.zh}</span> : null}
  </span>;
}

export function BackgroundLinks({ guides, language, onOpen }) {
  if (!guides.length) return null;
  return <section className="background-links" aria-label={copy('Background for these stories', '这些报道的背景知识', language)}>
    <div className="background-links-heading"><BookOpen size={17}/><strong>{copy('Background', '背景', language)}</strong></div>
    <div className="background-link-list">{guides.map(guide => <button key={guide.id} onClick={() => onOpen(guide.id)}>
      {bilingual(guide.title, language)}<ArrowRight size={15}/>
    </button>)}</div>
  </section>;
}

function SourceRefs({ ids = [], sources, language }) {
  return <span className="background-source-refs">{ids.map(id => {
    const index = sources.findIndex(source => source.id === id);
    if (index < 0) return null;
    const source = sources[index];
    return <a key={id} href={source.url} target="_blank" rel="noreferrer" title={`${source.publisher}: ${source.title}`} aria-label={`${copy('Source', '来源', language)} ${index + 1}: ${source.title}`}>[{index + 1}]</a>;
  })}</span>;
}

function GuideSection({ id, en, zh, language, children, open = false }) {
  return <details className="background-section" id={id} open={open}>
    <summary><span>{copy(en, zh, language)}</span><ChevronDown size={18}/></summary>
    <div className="background-section-body">{children}</div>
  </details>;
}

function Guide({ guide, data, language, onOpenArticle }) {
  const relatedArticles = useMemo(() => (data?.articles || [])
    .filter(article => matchingBackgroundGuides(article, [guide]).length)
    .slice().sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    .slice(0, 4), [data?.articles, guide]);
  const sourceKinds = {
    'historical-record': copy('Record / background', '记录／历史背景', language),
    'institutional-position': copy('Institution’s stated position', '机构自述立场', language),
    'independent-reporting': copy('Independent reporting', '独立报道', language),
  };
  return <article className="background-guide" aria-labelledby="background-guide-title" data-guide-id={guide.id}>
    <header className="background-guide-header">
      <span className="background-eyebrow">{copy('BACKGROUND', '背景知识', language)}</span>
      <h2 id="background-guide-title"><DualLabel value={guide.title} language={language}/></h2>
      <div className="background-dates">
        <span>{copy('Sources checked', '资料核查于', language)} <time dateTime={guide.reviewedAt}>{guide.reviewedAt}</time></span>
        <span>{copy('Covers through', '内容截至', language)} <time dateTime={guide.coverageThrough}>{guide.coverageThrough}</time></span>
      </div>
    </header>
    <div className="background-overview"><ReadingText value={guide.overview} language={language}/></div>
    <section className="background-takeaways" aria-label={copy('Key points', '要点', language)}>
      <h3>{copy('Key points', '要点', language)}</h3>
      <ol>{guide.takeaways.map((item, index) => <li key={index}><span aria-hidden="true">0{index + 1}</span><ReadingText value={item} language={language}/></li>)}</ol>
    </section>
    <GuideSection id="background-actors" en="People & institutions" zh="人物与机构" language={language} open>
      <div className="background-actors">{guide.actors.map((actor, index) => <section className="background-actor" key={index}>
        <h4><DualLabel value={actor.name} language={language}/><SourceRefs ids={actor.sourceIds} sources={guide.sources} language={language}/></h4>
        <div className="background-actor-role"><ReadingText value={actor.role} language={language}/></div>
        <ReadingText value={actor.position} language={language}/>
      </section>)}</div>
    </GuideSection>
    <GuideSection id="background-roots" en="Background" zh="历史背景" language={language}>
      <ReadingText value={guide.roots} language={language}/>
    </GuideSection>
    <GuideSection id="background-timeline" en="Timeline" zh="时间线" language={language}>
      <ol className="background-timeline">{guide.timeline.map((event, index) => <li key={`${event.date}-${index}`}>
        <time>{event.date}</time><div><h4><DualLabel value={event.title} language={language}/><SourceRefs ids={event.sourceIds} sources={guide.sources} language={language}/></h4><ReadingText value={event.detail} language={language}/></div>
      </li>)}</ol>
    </GuideSection>
    <GuideSection id="background-terms" en="Key terms" zh="术语" language={language}>
      <dl className="background-terms">{guide.terms.map((item, index) => <div key={index}><dt><DualLabel value={item.term} language={language}/></dt><dd><ReadingText value={item.meaning} language={language}/></dd></div>)}</dl>
    </GuideSection>
    <GuideSection id="background-reading" en="Reading guide" zh="阅读提示" language={language} open>
      <ul className="background-reading-lens">{guide.readingLens.map((item, index) => <li key={index}><ReadingText value={item} language={language}/></li>)}</ul>
    </GuideSection>
    <GuideSection id="background-sources" en={`Sources · ${guide.sources.length}`} zh={`来源 · ${guide.sources.length}`} language={language}>
      <ol className="background-sources">{guide.sources.map(source => <li key={source.id}>
        <a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={14}/></a>
        <p>{source.publisher} · {sourceKinds[source.kind] || source.kind}{source.publishedAt ? ` · ${source.publishedAt}` : ''}</p>
      </li>)}</ol>
    </GuideSection>
    <section className="background-collected">
      <h3>{copy('Related reporting', '相关报道', language)}</h3>
      {relatedArticles.length ? <ul>{relatedArticles.map(article => <li key={article.id}><button onClick={() => onOpenArticle(article)}>{article.title}<ArrowUpRight size={15}/></button><small>{article.sourceName} · {dateTime(article.publishedAt)}</small></li>)}</ul>
        : <p className="background-empty">{copy('No related reports.', '暂无相关报道。', language)}</p>}
    </section>
  </article>;
}

export default function BackgroundLibrary({ guides, selectedId, onSelect, data, language, onReturn, onOpenArticle }) {
  const [query, setQuery] = useState('');
  const [desk, setDesk] = useState('all');
  const filtered = useMemo(() => filterBackgroundGuides(guides, query).filter(guide => desk === 'all' || guide.category === desk), [guides, query, desk]);
  const selected = guides.find(guide => guide.id === selectedId) || guides[0];
  const guideRef = useRef(null);
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    const heading = guideRef.current?.querySelector('h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [selectedId, query]);
  function select(id) {
    shouldFocus.current = true;
    onSelect(id);
    setQuery('');
    if (id === selectedId) guideRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  return <div className="background-library">
    <div className="background-library-toolbar">
      <button className="text-link" onClick={onReturn}><ArrowLeft size={16}/>{copy('Back to reading', '返回新闻阅读', language)}</button>
      <label className="background-search"><Search size={16}/><span className="visually-hidden">{copy('Search background guides', '搜索背景知识', language)}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy('Find an actor, topic or term…', '搜索人物、主题或术语…', language)}/></label>
    </div>
    <div className="background-maintenance" aria-label={copy('Library status', '知识库状态', language)}>
      {data?.background?.generatedAt ? <span>{copy('Updated', '更新于', language)} {dateTime(data.background.generatedAt)}</span> : null}
      {data?.background?.isStale ? <span>{copy('Review pending', '待复核', language)}</span> : null}
      {data?.background?.loadError ? <details className="background-load-error"><summary>{copy('Using bundled guides', '显示内置指南', language)}</summary><p>{data.background.loadError}</p></details> : null}
    </div>
    <div className="background-desk-tabs" role="group" aria-label={copy('Filter background by reading desk', '按阅读栏目筛选背景', language)}>
      {[{ id: 'all', shortEn: 'All topics', shortZh: '全部主题' }, ...readingSections].map(section => <button key={section.id} aria-pressed={desk === section.id} className={desk === section.id ? 'active' : ''} onClick={() => {
        setDesk(section.id); setQuery('');
        if (section.id !== 'all' && selected?.category !== section.id) {
          const first = guides.find(guide => guide.category === section.id);
          if (first) onSelect(first.id);
        }
      }}>
        {copy(section.shortEn, section.shortZh, language)} <span>{guides.filter(guide => section.id === 'all' || guide.category === section.id).length}</span>
      </button>)}
    </div>
    <div className="background-browser">
    <div className="background-directory">
    <div className="background-catalog-heading"><BookOpen size={18}/><h2>{copy('Topics', '主题', language)}</h2><span>{filtered.length}/{guides.length}</span></div>
    <div className="background-catalog" aria-label={copy('Background guides', '背景知识指南', language)}>
      {filtered.map(guide => <button key={guide.id} className={`background-card ${guide.id === selected?.id ? 'is-selected' : ''}`} aria-pressed={guide.id === selected?.id} aria-controls="background-guide-content" onClick={() => select(guide.id)}>
        <span className="background-card-top"><span>{copy('EXPLAINER', '背景指南', language)} {String(guides.indexOf(guide) + 1).padStart(2, '0')}</span><ArrowRight size={17}/></span>
        <h3><DualLabel value={guide.title} language={language}/></h3><DualLabel value={guide.subtitle} language={language} className="background-card-subtitle"/>
      </button>)}
    </div>
    {!filtered.length ? <div className="background-empty" role="status"><p>{copy('No guides found.', '暂无匹配指南。', language)}</p><button className="text-link" onClick={() => { setQuery(''); setDesk('all'); }}>{copy('Show all guides', '显示全部指南', language)}<ArrowRight size={14}/></button></div> : null}
    </div>
    {!query.trim() && selected ? <div ref={guideRef} id="background-guide-content"><Guide key={selected.id} guide={selected} data={data} language={language} onOpenArticle={onOpenArticle}/></div> : null}
    </div>
  </div>;
}
