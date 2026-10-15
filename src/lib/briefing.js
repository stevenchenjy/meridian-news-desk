import { hasAnalysis, articleForReview } from './attention.js';

const headings = {
  us: { en: 'US briefing', zh: '美国简报' },
  world: { en: 'World briefing', zh: '国际简报' },
  economy: { en: 'Economy briefing', zh: '财经简报' },
  crisis: { en: 'Crisis briefing', zh: '危机简报' },
  sdg: { en: 'UN & development', zh: '联合国与发展' },
  industry: { en: 'Industry briefing', zh: '行业简报' },
};

export function matchesTopic(article, category) {
  return category === 'all' || article.category === category || article.relatedCategories?.includes(category);
}

function latestDate(dates) {
  return dates.filter(Boolean).sort().at(-1) || null;
}

function eventIdentity(article) {
  return article.attention?.eventId || article.eventId || article.id;
}

function isReviewed(article) {
  return hasAnalysis(article) && (!article.analysis.isStale || article.isReviewedSnapshot);
}

// The same visible selection drives notes, watches and counts. A missing topic
// note must never fall back to the global overview from a different section.
export function buildBriefingContext(data, { view = 'briefing', category = 'all', articles = [], search = '' } = {}) {
  const visible = articles.filter(article => matchesTopic(article, category));
  const allowedIds = new Set(visible.map(article => article.id));
  const events = (data.attention?.items || []).filter(event => event.memberArticleIds?.some(id => allowedIds.has(id)) || allowedIds.has(event.articleId));
  for (const event of events) for (const id of event.memberArticleIds || []) allowedIds.add(id);
  const sectionNotes = data.briefing?.sectionNotes || {};
  const scope = category;
  const useAuthored = view !== 'saved' && !search.trim() && (view === 'briefing' || category !== 'all');
  let notes = useAuthored ? (sectionNotes[scope] || []).filter(note => note.articleIds.every(id => allowedIds.has(id))).map(note => ({ ...note, kind: 'analysis' })) : [];
  if (!notes.length) {
    const singleNotes = new Map(Object.values(sectionNotes).flat().filter(note => note.articleIds.length === 1).map(note => [note.articleIds[0], note]));
    const seen = new Set();
    // A matching researched explanation is more useful than an unreviewed
    // excerpt when both are available in the reader's filtered selection.
    notes = [...visible].sort((a, b) => Number(isReviewed(b)) - Number(isReviewed(a))).filter(article => {
      const identity = eventIdentity(article);
      if (seen.has(identity) || !article.summary?.en || !article.summary?.zh) return false;
      seen.add(identity);
      return true;
    }).slice(0, 3).map(article => {
      const reviewed = isReviewed(article);
      const authored = reviewed ? singleNotes.get(article.id) : null;
      return {
        title: authored?.title || { en: article.title, zh: article.title },
        summary: authored?.summary || article.summary,
        background: authored?.background || (reviewed ? backgroundForArticle(data, article.id, category) || article.analysis.context : null),
        articleIds: [article.id],
        kind: reviewed ? 'analysis' : 'source',
      };
    });
  }
  notes = notes.slice(0, 3).map(note => {
    const references = note.articleIds.map(id => articleForReview(data, id)).filter(Boolean);
    return {
      ...note,
      background: note.background || (note.kind === 'analysis' ? references[0]?.analysis?.context : null),
      reviewedAt: note.kind === 'analysis' ? latestDate(references.map(article => article.analysis?.analyzedAt)) : null,
      needsReview: references.some(article => article.isReviewedSnapshot || article.analysis?.isStale || article.attention?.needsReview),
    };
  });
  const watchSeen = new Set();
  const watch = visible.filter(article => {
    const identity = eventIdentity(article);
    if (!hasAnalysis(article) || watchSeen.has(identity)) return false;
    watchSeen.add(identity);
    return true;
  }).slice(0, 2).map(article => ({ articleId: article.id, text: article.analysis.watch }));
  const sourceIds = new Set(visible.map(article => article.sourceId));
  const heading = search.trim() ? { en: 'This selection', zh: '当前筛选' }
    : view === 'saved' ? { en: 'Your saved stories', zh: '收藏速览' }
    : headings[category] || (view === 'stream' ? { en: 'Latest reporting', zh: '新近报道' } : { en: 'Your priorities', zh: '重点速览' });
  return {
    heading, notes, watch, articles: visible, view, category,
    sources: (data.sources || []).filter(source => sourceIds.has(source.id)),
    unreadCount: events.filter(event => event.active && !event.isRead).length,
    heldCount: events.filter(event => event.heldUntilRead).length,
    reviewedAt: latestDate(notes.map(note => note.reviewedAt)),
    hasSourceNotes: notes.some(note => note.kind === 'source'),
  };
}

export function backgroundForArticle(data, id, category = 'all') {
  const notes = data.briefing?.sectionNotes || {};
  const candidates = [...(notes[category] || []), ...Object.values(notes).flat()];
  return candidates.find(note => note.background && note.articleIds.length === 1 && note.articleIds.includes(id))?.background
    || candidates.find(note => note.background && note.articleIds.includes(id))?.background
    || null;
}
