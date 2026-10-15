import { hasAnalysis, articleForReview } from './attention.js';
import { readingSections, buildSectionAssignments, matchesSection, sectionName } from './sections.js';

function latestDate(dates) {
  return dates.filter(Boolean).sort().at(-1) || null;
}

function eventIdentity(article) {
  return article.attention?.eventId || article.eventId || article.id;
}

function isReviewed(article) {
  return hasAnalysis(article) && (!article.analysis.isStale || article.isReviewedSnapshot);
}

function noteScopes(category) {
  return [...new Set([category, ...(readingSections.find(section => section.id === category)?.sourceCategories || [])])];
}

// Notes, watches and counts share the same exclusive event selection. Legacy
// source-topic notes remain usable only if every reference belongs here.
export function buildBriefingContext(data, { view = 'briefing', category = 'all', articles = [], search = '', assignments = buildSectionAssignments(data) } = {}) {
  const visible = articles.filter(article => matchesSection(article, category, assignments));
  const allowedIds = new Set(visible.map(article => article.id));
  const events = (data.attention?.items || []).filter(event => event.memberArticleIds?.some(id => allowedIds.has(id)) || allowedIds.has(event.articleId));
  for (const event of events) for (const id of event.memberArticleIds || []) allowedIds.add(id);
  const sectionNotes = data.briefing?.sectionNotes || {};
  const useAuthored = view !== 'saved' && !search.trim() && (view === 'briefing' || category !== 'all');
  const eventIds = new Map(events.flatMap(event => (event.memberArticleIds || [event.articleId]).map(id => [id, event.eventId])));
  const visibleOrder = new Map();
  visible.forEach((article, index) => visibleOrder.set(eventIdentity(article), index));
  let notes = [];
  if (useAuthored) {
    const candidates = noteScopes(category).flatMap(scope => sectionNotes[scope] || []).filter(note => note.articleIds.every(id => allowedIds.has(id) && (category === 'all' || assignments.get(id) === category)));
    const rank = note => Math.min(...note.articleIds.map(id => visibleOrder.get(eventIds.get(id) || id) ?? visible.findIndex(article => article.id === id)));
    const used = new Set();
    notes = candidates.map((note, index) => ({ ...note, kind: 'analysis', order: index })).sort((a, b) => rank(a) - rank(b) || a.order - b.order).filter(note => {
      const identities = note.articleIds.map(id => eventIds.get(id) || id);
      if (identities.some(id => used.has(id))) return false;
      identities.forEach(id => used.add(id));
      return true;
    });
  }
  if (!notes.length) {
    const singleNotes = new Map(Object.values(sectionNotes).flat().filter(note => note.articleIds.length === 1).map(note => [note.articleIds[0], note]));
    const seen = new Set();
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
    : category !== 'all' ? { en: sectionName(category, 'en'), zh: sectionName(category, 'zh') }
    : view === 'stream' ? { en: 'Latest reporting', zh: '新近报道' } : { en: 'Your priorities', zh: '重点速览' };
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
  const candidates = [...noteScopes(category).flatMap(scope => notes[scope] || []), ...Object.values(notes).flat()];
  return candidates.find(note => note.background && note.articleIds.length === 1 && note.articleIds.includes(id))?.background
    || candidates.find(note => note.background && note.articleIds.includes(id))?.background
    || null;
}
