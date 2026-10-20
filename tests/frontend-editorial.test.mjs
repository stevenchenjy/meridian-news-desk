import test from 'node:test';
import assert from 'node:assert/strict';
import { articleOpening, articleReaderBrief, articleReviewDue, editorialHeadline, editorialHeadlines, firstParagraph, firstSentence, reviewedEditorial } from '../src/lib/editorial.js';
import { buildBriefingContext } from '../src/lib/briefing.js';

const pair = en => ({ en, zh: `已核查：${en}` });
function reviewed(id = 'reviewed', desk = 'economy') {
  return {
    id, title: 'Publisher headline', category: desk, sourceId: 'source',
    summary: pair('The checked facts remain available.'),
    analysis: {
      headline: { en: 'Why the decision matters for households' },
      readerBrief: { en: 'The practical change comes first.\n\nThe mechanism and its limits follow.' },
      context: pair('An institution makes the decision.'),
      implications: pair('The supported judgment.\n\nFurther reasoning and attribution.'),
      uncertainty: pair('The specific evidence gap.'),
      watch: pair('The next observable test.'),
      evidence: [{ label: 'Checked source', url: 'https://example.org/report' }],
      analyzedAt: '2026-10-19T12:00:00Z',
    },
  };
}
function dataFor(articles) {
  return {
    articles, sources: [{ id: 'source' }],
    attention: { items: articles.filter(reviewedEditorial).map(article => ({
      eventId: `event-${article.id}`, articleId: article.id, memberArticleIds: [article.id], articleSnapshot: article, active: true,
    })) },
    briefing: {
      generatedAt: '2026-10-19T13:00:00Z',
      overview: pair('An overview supported by the selected reviewed stories.'),
      items: articles.filter(reviewedEditorial).map(article => ({ articleId: article.id })),
    },
  };
}

test('reviewed editorial headlines and openings preserve publisher facts and complete analysis', () => {
  const article = reviewed();
  const before = structuredClone(article);
  assert.equal(editorialHeadline(article), 'Why the decision matters for households');
  assert.deepEqual(articleOpening(article), { en: 'The practical change comes first.' });
  assert.equal(articleReaderBrief(article).en.split('\n\n').length, 2);
  assert.deepEqual(article, before);
});

test('English-only editorial text never fabricates a Chinese locale and Chinese can keep the existing source wording', () => {
  const article = reviewed();
  assert.deepEqual(editorialHeadlines(article), { en: 'Why the decision matters for households' });
  assert.equal(articleReaderBrief(article).zh, undefined);
  assert.equal(articleOpening(article).zh, undefined);
  assert.equal(editorialHeadline(article, 'zh'), article.title);
  article.title = { en: 'Publisher headline', zh: '原始中文标题' };
  assert.equal(editorialHeadline(article, 'zh'), '原始中文标题');
  article.analysis.headline.zh = '决定如何影响家庭';
  article.analysis.readerBrief.zh = '先说明实际变化。\n\n再解释机制及其限度。';
  assert.equal(editorialHeadline(article, 'zh'), '决定如何影响家庭');
  assert.equal(articleOpening(article).zh, '先说明实际变化。');
});

test('unreviewed source material cannot acquire an editorial voice from stray optional fields', () => {
  const article = reviewed();
  article.analysis.evidence = [];
  assert.equal(reviewedEditorial(article), false);
  assert.equal(editorialHeadline(article), article.title);
  assert.equal(articleReaderBrief(article), null);
  assert.deepEqual(articleOpening(article), article.summary);
  delete article.analysis;
  assert.equal(articleReaderBrief(article), null);
});

test('invalid editorial fields fall back independently to the original facts', () => {
  const article = reviewed();
  article.analysis.headline = { en: '   ', zh: '只有中文' };
  article.analysis.readerBrief = { zh: '只有中文' };
  assert.equal(editorialHeadline(article), article.title);
  assert.equal(articleReaderBrief(article), null);
  assert.deepEqual(articleOpening(article), article.summary);
});

test('an English copy in an optional Chinese editorial field is not rendered as a translation', () => {
  const article = reviewed();
  article.analysis.headline.zh = article.analysis.headline.en;
  article.analysis.readerBrief.zh = article.analysis.readerBrief.en;
  assert.equal(editorialHeadlines(article).zh, undefined);
  assert.equal(articleReaderBrief(article).zh, undefined);
});

test('stale current text cannot inherit an editorial brief while a labeled retained snapshot can keep its dated assessment', () => {
  const article = reviewed();
  article.analysis.isStale = true;
  assert.equal(articleReaderBrief(article), null);
  assert.equal(editorialHeadline(article), article.title);
  article.isReviewedSnapshot = true;
  assert.equal(articleReaderBrief(article).en, article.analysis.readerBrief.en);
  assert.equal(articleReviewDue(article), true);
  assert.equal(article.analysis.analyzedAt, '2026-10-19T12:00:00Z');
});

test('only an unfiltered edition with all supporting reviewed stories can carry the global overview', () => {
  const economy = reviewed('economy');
  const world = reviewed('world', 'world');
  const data = dataFor([economy, world]);
  const global = buildBriefingContext(data, { articles: [economy, world] });
  assert.deepEqual(global.overview, data.briefing.overview);
  assert.equal(global.editionAt, data.briefing.generatedAt);
  assert.ok(global.readingMinutes >= 1);
  for (const options of [
    { category: 'economy', articles: [economy, world] },
    { view: 'saved', articles: [economy, world] },
    { view: 'stream', articles: [economy, world] },
    { search: 'households', articles: [economy, world] },
    { articles: [economy] },
    { articles: [] },
  ]) assert.equal(buildBriefingContext(data, options).overview, null);
});

test('a legacy overview without documented supporting items stays out of the daily read', () => {
  const article = reviewed();
  const data = dataFor([article]);
  delete data.briefing.items;
  assert.equal(buildBriefingContext(data, { articles: [article] }).overview, null);
});

test('scoped notes use a reader brief only from their own reviewed event', () => {
  const economy = reviewed('economy');
  const world = reviewed('world', 'world');
  const data = dataFor([economy, world]);
  const context = buildBriefingContext(data, { category: 'economy', articles: [economy, world] });
  assert.deepEqual(context.notes[0].articleIds, [economy.id]);
  assert.deepEqual(context.notes[0].narrative, economy.analysis.readerBrief);
  assert.deepEqual(context.notes[0].summary, economy.summary);
  assert.deepEqual(context.notes[0].insightPreview, firstParagraph(economy.analysis.implications));
  assert.deepEqual(context.notes[0].insights[0].text, economy.analysis.implications);
});

test('a note can use an agreed reader brief across multiple reports covering the same event', () => {
  const primary = reviewed('primary');
  const supporting = reviewed('supporting');
  const data = dataFor([primary, supporting]);
  data.attention.items = [{
    eventId: 'one-event', articleId: primary.id, memberArticleIds: [primary.id, supporting.id], articleSnapshot: primary, active: true,
  }];
  data.briefing.sectionNotes = { all: [{
    title: pair('One event with two checked reports'), summary: primary.summary,
    background: primary.analysis.context, articleIds: [primary.id, supporting.id],
  }] };
  const context = buildBriefingContext(data, { articles: [primary] });
  assert.equal(context.notes.length, 1);
  assert.deepEqual(context.notes[0].narrative, primary.analysis.readerBrief);
  assert.equal(context.notes[0].insights.length, 1);

  delete supporting.analysis.readerBrief;
  assert.deepEqual(buildBriefingContext(data, { articles: [primary] }).notes[0].narrative, primary.analysis.readerBrief);
  supporting.analysis.readerBrief = { en: 'A conflicting reading of the same event.' };
  assert.equal(buildBriefingContext(data, { articles: [primary] }).notes[0].narrative, null);
});

test('a note spanning separate events keeps their analysis separate even if the reading briefs match', () => {
  const economy = reviewed('economy');
  const world = reviewed('world', 'world');
  const data = dataFor([economy, world]);
  data.briefing.sectionNotes = { all: [{
    title: pair('Two events'), summary: pair('An authored combined factual update.'),
    background: pair('The institutions involved.'), articleIds: [economy.id, world.id],
  }] };
  const context = buildBriefingContext(data, { articles: [economy, world] });
  assert.equal(context.notes[0].narrative, null);
  assert.deepEqual(context.notes[0].insights.map(insight => insight.articleId), [economy.id, world.id]);
});

test('raw and stale source-only selections retain no invented narrative, interpretation or watch', () => {
  const raw = { ...reviewed('raw', 'industry'), analysis: null };
  const stale = reviewed('stale', 'industry');
  stale.analysis.isStale = true;
  const data = { ...dataFor([]), articles: [raw, stale] };
  const context = buildBriefingContext(data, { view: 'stream', category: 'industry', articles: [raw, stale] });
  assert.ok(context.notes.every(note => note.kind === 'source' && note.narrative === null && note.insights.length === 0));
  assert.deepEqual(context.watch, []);
});

test('watch previews retain a complete sentence without cutting decimal numbers, institutional initials or Chinese prose', () => {
  assert.equal(firstSentence('Watch U.S. household income and the 4.8% growth figure. A second test follows.'), 'Watch U.S. household income and the 4.8% growth figure.');
  assert.equal(firstSentence('A documented test without final punctuation'), 'A documented test without final punctuation');
  assert.deepEqual(firstSentence({ en: 'The next payment is the test. Read more in the analysis.', zh: '后续观察实际付款。完整分析另附。' }), { en: 'The next payment is the test.', zh: '后续观察实际付款。' });
});
