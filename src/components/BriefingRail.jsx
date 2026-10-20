import { ArrowRight } from 'lucide-react';
import { copy, bilingual, dateTime } from '../lib/format';
import { articleForReview } from '../lib/attention';
import { editorialHeadline, editorialHeadlines, firstSentence } from '../lib/editorial';
import BriefingNotes from './BriefingNotes';

const types = [
  ['newsroom', 'Newsrooms', '新闻媒体'],
  ['official', 'Institutions', '机构'],
  ['research', 'Research', '研究'],
  ['community', 'Discussions', '讨论'],
];

export default function BriefingRail({ data, context, language, onSources, onOpen, showNotes = true }) {
  const enabled = context.sources.filter(source => source.enabled);
  const healthy = enabled.filter(source => source.status === 'ok');
  return <aside className="briefing-rail" aria-label="Section briefing">
    <section className="rail-summary">
      <div className="rail-label"><i />{copy('AT A GLANCE', '快速浏览', language)}</div>
      <h2>{bilingual(context.heading, language)}</h2>
      <p className="rail-scope-caption">{context.articles.length} {context.view === 'briefing' ? copy(context.articles.length === 1 ? 'event' : 'events', '个事件', language) : copy('reports', '篇报道', language)}</p>
      {showNotes ? <BriefingNotes context={context} data={data} language={language} onOpen={onOpen} compact /> : null}
      {context.reviewedAt ? <small className="rail-timestamp">
        {data.collection?.kind === 'synthetic_demo' ? copy('Demo generated', '演示生成于', language) : copy('Reviewed', '核查于', language)} {dateTime(context.reviewedAt)}
      </small> : null}
    </section>
    {context.watch.length ? <section className="watch-section">
      <h2>{copy('What to watch', '后续观察', language)}</h2>
      <ol>{context.watch.map((item, index) => {
        const article = articleForReview(data, item.articleId);
        const preview = firstSentence(item.text);
        const headline = editorialHeadlines(article);
        return <li key={item.articleId}>
        <span>{index + 1}</span>
        <button onClick={() => onOpen(article)}>
          <strong className="watch-story-title">{editorialHeadline(article, language)}</strong>
          {language === 'both' && headline.zh && headline.zh !== headline.en ? <span className="watch-chinese" lang="zh-Hans">{headline.zh}</span> : null}
          <span className="watch-preview">{bilingual(preview, language)}</span>
          {language === 'both' && preview?.zh ? <span className="watch-chinese" lang="zh-Hans">{preview.zh}</span> : null}
        </button>
      </li>;})}</ol>
    </section> : null}
    {context.unreadCount || context.heldCount ? <section className="coverage attention-rail">
      <div className="rail-label"><i />{copy('READING', '阅读', language)}</div>
      <p>{context.unreadCount} {copy('unread events', '个未读事件', language)} · {context.heldCount} {copy('held until read', '个保留至已读', language)}</p>
    </section> : null}
    <section className="coverage">
      <div className="rail-label"><i />{copy('SOURCES', '来源', language)}</div>
      {types.map(([id, en, zh]) => {
        const total = enabled.filter(source => source.type === id).length;
        const responding = healthy.filter(source => source.type === id).length;
        return total ? <div className="coverage-row" key={id}>
          <span>{copy(en, zh, language)}</span>
          <div className="coverage-bar" title={`${responding} of ${total} sources responding`}><div style={{ width: `${responding / total * 100}%` }} /></div>
          <small>{responding}/{total}</small>
        </div> : null;
      })}
      <button className="text-link" onClick={onSources}>{copy('Sources & status', '来源与状态', language)}<ArrowRight size={17} /></button>
    </section>
  </aside>;
}
