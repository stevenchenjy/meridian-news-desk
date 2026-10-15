import test from "node:test";
import assert from "node:assert/strict";
import {
  backgroundForArticle,
  buildBriefingContext,
} from "../src/lib/briefing.js";
import { attentionArticles } from "../src/lib/attention.js";

function pair(en, zh = "已核查的中文内容") {
  return { en, zh };
}

function reviewedArticle(id, category, sourceId) {
  return {
    id,
    category,
    sourceId,
    title: `${category} reviewed report`,
    summary: pair(`${category} reported facts`, `${category}事件的已核查事实`),
    analysis: {
      context: pair(`${category} institutions and earlier decisions explain the present development.`, "相关机构和先前决定构成理解此次进展的背景。"),
      implications: pair(`${category} conditional implications`),
      uncertainty: pair(`${category} remaining evidence limits`),
      watch: pair(`${category} next documented decision`),
      evidence: [{ label: "Reviewed report", url: `https://example.org/${id}` }],
      analyzedAt: "2026-10-10T12:00:00Z",
    },
  };
}

function authoredNote(article, label) {
  return {
    title: pair(`${label} context`, `${label}背景`),
    background: pair(`${label} institutional background.`, `${label}相关机构背景。`),
    summary: pair(`${label} latest development.`, `${label}最新进展。`),
    articleIds: [article.id],
  };
}

function fixture() {
  const world = reviewedArticle("treaty", "world", "world-source");
  const economy = reviewedArticle("central-bank", "economy", "economy-source");
  const related = {
    ...reviewedArticle("development-funding", "world", "un-source"),
    relatedCategories: ["world", "sdg"],
  };
  const raw = {
    id: "forum-color-theme",
    category: "industry",
    sourceId: "community-source",
    title: "Community forum changes its color theme",
    summary: pair("The publisher describes a forum color-theme change.", "发布者介绍了论坛配色变化。"),
    excerpt: "A source excerpt is available, but no independent research was performed.",
    analysis: null,
  };
  const articles = [world, economy, related, raw];
  const events = [world, economy, related].map((article, index) => ({
    eventId: `event-${article.id}`,
    articleId: article.id,
    memberArticleIds: [article.id],
    articleSnapshot: article,
    active: true,
    isRead: index === 1,
    heldUntilRead: index !== 1,
  }));
  const data = {
    articles,
    attention: { items: events },
    sources: articles.map((article) => ({ id: article.sourceId })),
    briefing: {
      overview: pair("GLOBAL OVERVIEW MUST NOT APPEAR IN EVERY TOPIC", "不能在每个主题中重复全局概述"),
      generatedAt: "2026-10-14T20:00:00Z",
      sectionNotes: {
        all: [{
          title: pair("Across today's priorities", "今日重点概览"),
          background: pair("Different institutions shape these two events.", "不同机构构成两项事件的背景。"),
          summary: pair("A combined world and economic update.", "国际与经济的综合进展。"),
          articleIds: [world.id, economy.id],
        }],
        world: [authoredNote(world, "World")],
        economy: [authoredNote(economy, "Economy")],
      },
    },
  };
  return { data, world, economy, related, raw };
}

test("topic briefings show their own background and latest development, with scoped watches and counts", () => {
  const { data } = fixture();
  const world = buildBriefingContext(data, { category: "world", articles: data.articles });
  const economy = buildBriefingContext(data, { category: "economy", articles: data.articles });
  assert.equal(world.heading.en, "World briefing");
  assert.equal(economy.heading.en, "Economy briefing");
  assert.equal(world.notes[0].background.en, "World institutional background.");
  assert.equal(economy.notes[0].summary.en, "Economy latest development.");
  assert.notDeepEqual(world.notes[0].summary, economy.notes[0].summary);
  assert.deepEqual(world.watch.map((item) => item.articleId), ["treaty", "development-funding"]);
  assert.deepEqual(economy.watch.map((item) => item.articleId), ["central-bank"]);
  assert.equal(world.unreadCount, 2);
  assert.equal(economy.unreadCount, 0);
  assert.deepEqual(economy.sources.map((source) => source.id), ["economy-source"]);
});

test("related-category reporting contributes to that topic's derived context", () => {
  const { data, related } = fixture();
  const context = buildBriefingContext(data, { category: "sdg", articles: data.articles });
  assert.deepEqual(context.articles.map((article) => article.id), [related.id]);
  assert.deepEqual(context.notes[0].summary, related.summary);
  assert.deepEqual(context.notes[0].background, related.analysis.context);
  assert.deepEqual(context.watch.map((item) => item.articleId), [related.id]);
  assert.equal(context.unreadCount, 1);
});

test("a legacy briefing without topic notes derives context from the selected topic instead of copying the global overview", () => {
  const { data, economy } = fixture();
  delete data.briefing.sectionNotes;
  const context = buildBriefingContext(data, { category: "economy", articles: data.articles });
  assert.deepEqual(context.notes[0].summary, economy.summary);
  assert.deepEqual(context.notes[0].background, economy.analysis.context);
  assert.notDeepEqual(context.notes[0].summary, data.briefing.overview);
  assert.equal(context.reviewedAt, economy.analysis.analyzedAt);
  assert.notEqual(context.reviewedAt, data.briefing.generatedAt);
});

test("saved and searched selections do not repeat a briefing for reports outside the visible selection", () => {
  const { data, economy } = fixture();
  for (const options of [
    { view: "saved", articles: [economy] },
    { view: "stream", articles: [economy], search: "central bank" },
  ]) {
    const context = buildBriefingContext(data, options);
    assert.deepEqual(context.notes.map((note) => note.articleIds), [[economy.id]]);
    assert.notEqual(context.notes[0].summary.en, "A combined world and economic update.");
    assert.deepEqual(context.watch.map((item) => item.articleId), [economy.id]);
    assert.deepEqual(context.sources.map((source) => source.id), [economy.sourceId]);
    assert.equal(context.unreadCount, 0);
  }
});

test("an empty topic or search selection has no unrelated notes, watches, sources or attention counts", () => {
  const { data } = fixture();
  for (const options of [
    { category: "us", articles: data.articles },
    { view: "stream", articles: [], search: "no matching result" },
    { view: "saved", articles: [] },
  ]) {
    const context = buildBriefingContext(data, options);
    assert.deepEqual(context.notes, []);
    assert.deepEqual(context.watch, []);
    assert.deepEqual(context.sources, []);
    assert.equal(context.unreadCount, 0);
    assert.equal(context.heldCount, 0);
    assert.equal(context.reviewedAt, null);
  }
});

test("raw publisher translations remain source notes without invented background or a research timestamp", () => {
  const { data, raw } = fixture();
  const context = buildBriefingContext(data, { view: "stream", category: "industry", articles: data.articles });
  assert.equal(context.notes[0].kind, "source");
  assert.deepEqual(context.notes[0].summary, raw.summary);
  assert.equal(context.notes[0].background, null);
  assert.equal(context.notes[0].reviewedAt, null);
  assert.equal(context.hasSourceNotes, true);
  assert.deepEqual(context.watch, []);
  assert.equal(backgroundForArticle(data, raw.id, "industry"), null);
});

test("filtered fallback prioritizes a matching researched explanation after three raw excerpts without borrowing an unrelated review", () => {
  const { data, raw, world } = fixture();
  delete data.briefing.sectionNotes;
  const rawMatches = [1, 2, 3].map((index) => ({
    ...raw,
    id: `matching-raw-${index}`,
    category: "economy",
    title: `New raw report ${index}`,
  }));
  const matchingReview = reviewedArticle("older-matching-research", "economy", "economy-source");
  const secondReview = reviewedArticle("second-matching-research", "economy", "economy-source");
  data.articles = [...rawMatches, matchingReview, secondReview, world];
  const selected = [...rawMatches, matchingReview, secondReview];
  const context = buildBriefingContext(data, {
    view: "stream",
    category: "economy",
    search: "matching report",
    articles: selected,
  });
  assert.deepEqual(context.notes.map((note) => note.articleIds[0]), [matchingReview.id, secondReview.id, rawMatches[0].id]);
  assert.equal(context.notes[0].kind, "analysis");
  assert.deepEqual(context.notes[0].background, matchingReview.analysis.context);
  assert.equal(context.notes[2].kind, "source");
  assert.equal(context.notes[2].background, null);
  assert.ok(context.notes.every((note) => !note.articleIds.includes(world.id)));
  assert.deepEqual(context.articles.map((article) => article.id), selected.map((article) => article.id));

  const rawOnly = buildBriefingContext(data, {
    view: "stream",
    category: "economy",
    search: "new raw report",
    articles: rawMatches,
  });
  assert.deepEqual(rawOnly.notes.map((note) => note.articleIds[0]), rawMatches.map((article) => article.id));
  assert.ok(rawOnly.notes.every((note) => note.kind === "source" && note.background === null));
});

test("retained reviewed snapshots keep historical background and their original evidence date", () => {
  const { data, world } = fixture();
  delete data.briefing.sectionNotes;
  const snapshot = {
    ...world,
    isReviewedSnapshot: true,
    analysis: { ...world.analysis, isStale: true },
  };
  data.articles = [{ ...world, summary: pair("Changed unreviewed source text", "未经重新核查的变化文本"), analysis: null }];
  data.attention.items = [{
    eventId: "event-treaty",
    articleId: world.id,
    memberArticleIds: [world.id],
    articleSnapshot: snapshot,
    active: true,
    isRead: false,
    heldUntilRead: true,
    contentChanged: true,
    needsReview: true,
  }];
  const context = buildBriefingContext(data, { category: "world", articles: attentionArticles(data) });
  assert.equal(context.notes[0].kind, "analysis");
  assert.deepEqual(context.notes[0].background, world.analysis.context);
  assert.deepEqual(context.notes[0].summary, world.summary);
  assert.equal(context.notes[0].reviewedAt, world.analysis.analyzedAt);
  assert.equal(context.notes[0].needsReview, true);
  assert.equal(context.reviewedAt, world.analysis.analyzedAt);
});

test("linked member reports resolve to the selected event's reviewed context", () => {
  const { data, world } = fixture();
  data.attention.items[0].memberArticleIds.push("wire-copy");
  data.briefing.sectionNotes.world = [{
    ...authoredNote(world, "World"),
    articleIds: ["wire-copy"],
  }];
  const context = buildBriefingContext(data, { category: "world", articles: [world] });
  assert.deepEqual(context.notes[0].articleIds, ["wire-copy"]);
  assert.equal(context.notes[0].reviewedAt, world.analysis.analyzedAt);
  assert.equal(context.notes[0].background.en, "World institutional background.");
});

test("article background prefers the current topic's authored context", () => {
  const { data, world } = fixture();
  data.briefing.sectionNotes.all = [{
    ...authoredNote(world, "General"),
    background: pair("General event background.", "事件的一般背景。"),
  }];
  assert.equal(backgroundForArticle(data, world.id, "world").en, "World institutional background.");
});
