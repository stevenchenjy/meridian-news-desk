import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionArticles,
  priorityBand,
  articleForReview,
} from "../src/lib/attention.js";

const pair = { en: "Reviewed facts", zh: "已复核事实" };
const reviewed = {
  id: "older",
  summary: pair,
  analysis: {
    context: pair,
    implications: pair,
    uncertainty: pair,
    watch: pair,
    evidence: [{ url: "https://example.org/evidence" }],
  },
};

test("the attention agenda excludes raw entries even when they have translated summaries", () => {
  const raw = { id: "newer", summary: pair };
  const items = attentionArticles({
    articles: [raw, reviewed],
    attention: {
      items: [
        { articleId: raw.id, articleSnapshot: raw, importance: 99 },
        { articleId: reviewed.id, articleSnapshot: reviewed, importance: 87 },
      ],
    },
  });
  assert.deepEqual(
    items.map((a) => a.id),
    ["older"],
  );
});

test("changed source content uses the retained reviewed snapshot and current event read state", () => {
  const raw = {
    id: "older",
    summary: { en: "Changed source", zh: "变化的来源" },
  };
  const event = {
    articleId: "older",
    articleSnapshot: reviewed,
    contentChanged: true,
    isRead: true,
  };
  const [article] = attentionArticles({
    articles: [raw],
    attention: { items: [event] },
  });
  assert.deepEqual(article.summary, pair);
  assert.equal(article.isReviewedSnapshot, true);
  assert.equal(article.isRead, true);
});

test("a reviewed event remains readable after its raw entry leaves the collection", () => {
  const [article] = attentionArticles({
    articles: [],
    attention: {
      items: [
        { articleId: reviewed.id, articleSnapshot: reviewed, isRead: false },
      ],
    },
  });
  assert.equal(article.id, "older");
  assert.equal(article.isRead, false);
});

test("overview and watch links retain analyzed details when source text changes or leaves", () => {
  const event = {
    articleId: "older",
    memberArticleIds: ["older", "duplicate"],
    articleSnapshot: reviewed,
  };
  const data = {
    articles: [{ id: "older", summary: pair }],
    attention: { items: [event] },
  };
  assert.deepEqual(articleForReview(data, "older").analysis, reviewed.analysis);
  assert.equal(articleForReview(data, "duplicate").attention, event);
  assert.equal(articleForReview({ ...data, articles: [] }, "older").id, "older");
});

test("importance bands agree at the policy boundaries", () => {
  assert.equal(priorityBand(85).en, "Major");
  assert.equal(priorityBand(84).en, "High");
  assert.equal(priorityBand(75).en, "High");
  assert.equal(priorityBand(74).en, "Context");
  assert.equal(priorityBand(60).en, "Context");
  assert.equal(priorityBand(59).en, "Lower priority");
});
