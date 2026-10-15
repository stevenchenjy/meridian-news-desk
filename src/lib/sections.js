import config from '../../config/reading-sections.json' with { type: 'json' };

export const readingSections = config.sections;
const sectionIds = new Set(readingSections.map(section => section.id));
const sourceHomes = new Map(readingSections.flatMap(section => section.sourceCategories.map(category => [category, section.id])));

export function sectionName(id, language = 'en') {
  const section = readingSections.find(item => item.id === id);
  return section?.[language === 'zh' ? 'zh' : 'en'] || id;
}

function explicitHome(value) {
  return sectionIds.has(value) ? value : null;
}

export function defaultSection(article) {
  return explicitHome(article.attention?.readingSection || article.readingSection) || sourceHomes.get(article.category) || null;
}

// Routing is exclusive. An editor's event assignment overrides publisher-feed
// categories for every supporting report, including retained snapshots.
export function buildSectionAssignments(data) {
  const current = new Map((data.articles || []).map(article => [article.id, article]));
  const assignments = new Map([...current.values()].map(article => [article.id, defaultSection(article)]));
  for (const event of data.attention?.items || []) {
    const primary = event.articleSnapshot || current.get(event.articleId);
    const home = explicitHome(event.readingSection) || (primary ? defaultSection(primary) : null);
    if (!home) continue;
    for (const id of new Set([event.articleId, ...(event.memberArticleIds || [])])) assignments.set(id, home);
  }
  return assignments;
}

export function sectionForArticle(article, assignments) {
  return assignments?.get(article.id) || defaultSection(article);
}

export function matchesSection(article, section, assignments) {
  return section === 'all' || sectionForArticle(article, assignments) === section;
}

export function sectionCounts(articles, assignments) {
  const counts = Object.fromEntries(readingSections.map(section => [section.id, 0]));
  for (const article of articles) {
    const home = sectionForArticle(article, assignments);
    if (home && !article.isRead && article.attention?.active) counts[home]++;
  }
  return counts;
}
