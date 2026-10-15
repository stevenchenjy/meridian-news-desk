import { ArrowRight } from 'lucide-react';
import { copy, bilingual, dateTime } from '../lib/format';
import { articleForReview } from '../lib/attention';
import BriefingNotes from './BriefingNotes';

const types = [
  ['newsroom', 'Newsrooms', '新闻媒体'],
  ['official', 'Official institutions', '官方机构'],
  ['research', 'Policy & research', '政策与研究'],
  ['community', 'Community discussions', '社区讨论'],
];

export default function BriefingRail({ data, context, language, onSources, onOpen }) {
  const enabled = context.sources.filter(source => source.enabled);
  const healthy = enabled.filter(source => source.status === 'ok');
  return <aside className="briefing-rail" aria-label="Section briefing">
    <section className="rail-summary">
      <div className="rail-label"><i />{copy('BRIEFING NOTES', '简报笔记', language)}</div>
      <h2>{bilingual(context.heading, language)}</h2>
      <p className="rail-scope-caption">{context.articles.length} {copy('reports in this view', '篇当前范围内的报道', language)}</p>
      <BriefingNotes context={context} data={data} language={language} onOpen={onOpen} />
      {context.reviewedAt ? <small className="rail-timestamp">
        {data.collection?.kind === 'synthetic_demo' ? copy('Demo generated', '演示生成于', language) : copy('Based on research from', '依据此时核查的报道', language)} {dateTime(context.reviewedAt)}
      </small> : null}
    </section>
    {context.watch.length ? <section className="watch-section">
      <h2>{copy('What to watch', '后续观察', language)}</h2>
      <ol>{context.watch.map((item, index) => <li key={item.articleId}>
        <span>{index + 1}</span>
        <button onClick={() => onOpen(articleForReview(data, item.articleId))}>
          {bilingual(item.text, language)}
          {language === 'both' && item.text?.zh ? <span className="watch-chinese" lang="zh-Hans">{item.text.zh}</span> : null}
        </button>
      </li>)}</ol>
    </section> : null}
    {context.unreadCount || context.heldCount ? <section className="coverage attention-rail">
      <div className="rail-label"><i />{copy('ATTENTION IN THIS VIEW', '当前范围内的关注', language)}</div>
      <p>{context.unreadCount} {copy('unread events', '个未读事件', language)} · {context.heldCount} {copy('held until read', '个保留至已读', language)}</p>
      <small>{copy('Mark read when you have caught up. A major development can bring an event back.', '读完后可标为已读。出现重大进展时，事件会重新提醒。', language)}</small>
    </section> : null}
    <section className="coverage">
      <div className="rail-label"><i />{copy('SOURCES IN THIS VIEW', '当前范围内的来源', language)}</div>
      {types.map(([id, en, zh]) => {
        const total = enabled.filter(source => source.type === id).length;
        const responding = healthy.filter(source => source.type === id).length;
        return total ? <div className="coverage-row" key={id}>
          <span>{copy(en, zh, language)}</span>
          <div className="coverage-bar" title={`${responding} of ${total} sources responding`}><div style={{ width: `${responding / total * 100}%` }} /></div>
          <small>{responding}/{total}</small>
        </div> : null;
      })}
      <button className="text-link" onClick={onSources}>{copy('View source ledger', '查看来源台账', language)}<ArrowRight size={17} /></button>
    </section>
  </aside>;
}
