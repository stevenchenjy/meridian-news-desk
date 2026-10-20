// Match only the article's reader-facing explanation. Publisher names, URLs,
// tags and evidence labels do not establish what an article is about.
function bilingualText(value) {
  if (typeof value === 'string') return value;
  return [value?.en, value?.zh].filter(text => typeof text === 'string').join(' ');
}

function normalize(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function articleText(article) {
  return [article?.title, article?.excerpt, article?.summary,
    article?.analysis?.context, article?.attention?.reason]
    .map(bilingualText).map(normalize).filter(Boolean);
}

function matchesKeyword(text, keyword) {
  const needle = normalize(typeof keyword === 'string' ? keyword : '');
  if (!needle) return false;
  // Chinese words are normally written without spaces. Latin keywords need
  // word boundaries, including beside digits, to avoid e.g. Iran -> Tirana.
  if (/\p{Script=Han}/u.test(needle)) return text.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{Script=Latin}\\p{N}])${escaped}(?![\\p{Script=Latin}\\p{N}])`, 'u').test(text);
}

export function matchingBackgroundGuides(article, guides = []) {
  const fields = articleText(article);
  return guides.filter(guide => (guide.keywords || [])
    .some(keyword => fields.some(text => matchesKeyword(text, keyword))));
}

export function relatedBackgroundGuides(articles = [], guides = [], limit = 3) {
  const matches = new Map(guides.map(guide => [guide, new Set()]));
  for (const article of articles) {
    if (!article) continue;
    for (const guide of matchingBackgroundGuides(article, guides)) {
      // A retained copy of the same article must not boost a guide's rank.
      matches.get(guide).add(article.id ?? article);
    }
  }
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : guides.length;
  return guides.map((guide, index) => ({ guide, index, count: matches.get(guide).size }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, count).map(item => item.guide);
}

export function filterBackgroundGuides(guides = [], query = '') {
  const needle = normalize(typeof query === 'string' ? query : '');
  if (!needle) return guides;
  return guides.filter(guide => [guide.title, guide.subtitle, guide.overview,
    ...(guide.keywords || []), ...(guide.actors || []).map(actor => actor.name),
    ...(guide.terms || []).map(entry => entry.term)]
    .map(bilingualText).some(value => normalize(value).includes(needle)));
}
