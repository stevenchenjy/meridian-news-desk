import { articleForReview } from './attention.js';
import { readingSections, buildSectionAssignments, matchesSection, sectionName } from './sections.js';
import { articleReaderBrief, editorialHeadlines, firstParagraph, readingMinutes, reviewedEditorial } from './editorial.js';

function latestDate(dates) {
  return dates.filter(Boolean).sort().at(-1) || null;
}

function eventIdentity(article) {
  return article.attention?.eventId || article.eventId || article.id;
}

function isReviewed(article) {
  return reviewedEditorial(article);
}

function noteScopes(category) {
  return [...new Set([category, ...(readingSections.find(section => section.id === category)?.sourceCategories || [])])];
}

function narrativeForNote(note, references, eventIds) {
  if (note.kind !== 'analysis') return null;
  const identities = new Set(note.articleIds.map(id => eventIds.get(id) || eventIdentity(references.find(article => article.id === id) || { id })));
  if (identities.size !== 1) return null;
  const briefs = references.map(articleReaderBrief).filter(Boolean);
  if (!briefs.length) return null;
  const en = [...new Set(briefs.map(brief => brief.en))];
  const zh = [...new Set(briefs.map(brief => brief.zh).filter(Boolean))];
  if (en.length !== 1 || zh.length > 1) return null;
  return { en: en[0], ...(zh.length ? { zh: zh[0] } : {}) };
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
  const reviewDueEvents = new Set(events.filter(event => event.needsReview).map(event => event.eventId));
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
        title: authored?.title || editorialHeadlines(article),
        summary: authored?.summary || article.summary,
        background: authored?.background || (reviewed ? backgroundForArticle(data, article.id, category) || article.analysis.context : null),
        articleIds: [article.id],
        kind: reviewed ? 'analysis' : 'source',
      };
    });
  }
  notes = notes.slice(0, 3).map(note => {
    const references = note.articleIds.map(id => articleForReview(data, id)).filter(Boolean);
    const insightEvents = new Set();
    const insights = note.kind === 'analysis' ? note.articleIds.flatMap(id => {
      const article = articleForReview(data, id);
      if (!isReviewed(article || {})) return [];
      const identity = eventIds.get(id) || eventIdentity(article);
      if (insightEvents.has(identity)) return [];
      insightEvents.add(identity);
      return [{
        articleId: article.id,
        title: editorialHeadlines(article),
        text: article.analysis.implications,
        reviewedAt: article.analysis.analyzedAt,
        needsReview: Boolean(reviewDueEvents.has(identity) || article.isReviewedSnapshot || article.analysis.isStale || article.attention?.needsReview),
      }];
    }) : [];
    return {
      ...note,
      insights,
      narrative: narrativeForNote(note, references, eventIds),
      insightPreview: firstParagraph(insights[0]?.text),
      background: note.background || (note.kind === 'analysis' ? references[0]?.analysis?.context : null),
      reviewedAt: note.kind === 'analysis' ? latestDate(references.map(article => article.analysis?.analyzedAt)) : null,
      needsReview: insights.some(insight => insight.needsReview) || references.some(article => article.isReviewedSnapshot || article.analysis?.isStale || article.attention?.needsReview),
    };
  });
  const watchSeen = new Set();
  const watch = visible.filter(article => {
    const identity = eventIdentity(article);
    if (!isReviewed(article) || watchSeen.has(identity)) return false;
    watchSeen.add(identity);
    return true;
  }).slice(0, 2).map(article => ({ articleId: article.id, text: article.analysis.watch }));
  const sourceIds = new Set(visible.map(article => article.sourceId));
  const heading = search.trim() ? { en: 'This selection', zh: '当前筛选' }
    : view === 'saved' ? { en: 'Your saved stories', zh: '收藏速览' }
    : category !== 'all' ? { en: sectionName(category, 'en'), zh: sectionName(category, 'zh') }
    : view === 'stream' ? { en: 'Latest reporting', zh: '新近报道' } : { en: 'Today’s briefing', zh: '今日简报' };
  const overviewIds = (data.briefing?.items || []).map(item => item.articleId);
  const overview = view === 'briefing' && category === 'all' && !search.trim()
    && overviewIds.length > 0 && overviewIds.every(id => allowedIds.has(id) && isReviewed(articleForReview(data, id) || {}))
    ? data.briefing.overview : null;
  const editionAt = data.briefing?.generatedAt || latestDate(notes.map(note => note.reviewedAt));
  return {
    heading, notes, watch, articles: visible, view, category, overview, editionAt,
    overviewIsStale: Boolean(overview && data.briefing?.isStale),
    readingMinutes: readingMinutes([overview, ...notes.map(note => note.narrative || note.summary), ...notes.filter(note => !note.narrative).map(note => note.insightPreview)]),
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
