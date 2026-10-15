import test from "node:test";
import assert from "node:assert/strict";
import {
  readingSections,
  defaultSection,
  buildSectionAssignments,
  sectionForArticle,
  matchesSection,
  sectionCounts,
} from "../src/lib/sections.js";
import { attentionArticles } from "../src/lib/attention.js";

const pair = { en: "Reviewed facts", zh: "已复核事实" };

function article(id, category, relatedCategories = []) {
  return {
    id,
    category,
    relatedCategories,
    summary: pair,
    analysis: {
      context: pair,
      implications: pair,
      uncertainty: pair,
      watch: pair,
      evidence: [{ url: `https://example.org/${id}` }],
    },
  };
}

function event(primary, readingSection, members = [primary.id], overrides = {}) {
  return {
    eventId: `event-${primary.id}`,
    articleId: primary.id,
    memberArticleIds: members,
    articleSnapshot: primary,
    readingSection,
    active: true,
    isRead: false,
    ...overrides,
  };
}

function crossTopicFixture() {
  const press = article("press-access", "world", ["us", "economy"]);
  const pressSupporting = article("press-supporting-report", "economy", ["world"]);
  const cook = article("central-bank-governance", "us", ["world"]);
  const australia = article("australia-feed-choice", "world", ["us", "industry"]);
  const hormuz = article("hormuz-shipping", "economy", ["world", "crisis"]);
  const yemen = article("yemen-aid-access", "crisis", ["world", "sdg"]);
  const jobs = article("undp-jobs", "sdg", ["economy", "industry"]);
  const articles = [press, pressSupporting, cook, australia, hormuz, yemen, jobs];
  return {
    articles,
    attention: {
      items: [
        event(press, "politics", [press.id, pressSupporting.id]),
        event(cook, "economy"),
        event(australia, "industry"),
        event(hormuz, "economy"),
        event(yemen, "development"),
        event(jobs, "development"),
      ],
    },
  };
}

test("four reading desks partition cross-topic reports into one home each", () => {
  const data = crossTopicFixture();
  const assignments = buildSectionAssignments(data);
  assert.deepEqual(readingSections.map((section) => section.id), [
    "politics", "economy", "development", "industry",
  ]);
  const memberships = readingSections.map((section) => data.articles
    .filter((item) => matchesSection(item, section.id, assignments))
    .map((item) => item.id));
  assert.deepEqual(memberships, [
    ["press-access", "press-supporting-report"],
    ["central-bank-governance", "hormuz-shipping"],
    ["yemen-aid-access", "undp-jobs"],
    ["australia-feed-choice"],
  ]);
  const union = memberships.flat();
  assert.equal(new Set(union).size, union.length, "no report appears in two desks");
  assert.deepEqual(new Set(union), new Set(data.articles.map((item) => item.id)),
    "every classified report stays accessible");
});

test("related category tags do not add extra reading desks", () => {
  const shipping = article("shipping", "economy", ["world", "crisis", "industry", "sdg"]);
  const assignments = buildSectionAssignments({ articles: [shipping] });
  assert.equal(defaultSection(shipping), "economy");
  assert.deepEqual(readingSections
    .filter((section) => matchesSection(shipping, section.id, assignments))
    .map((section) => section.id), ["economy"]);
});

test("an editorial event assignment routes inconsistent publisher categories together", () => {
  const data = crossTopicFixture();
  const assignments = buildSectionAssignments(data);
  assert.equal(sectionForArticle(data.articles[0], assignments), "politics");
  assert.equal(sectionForArticle(data.articles[1], assignments), "politics");
  assert.equal(sectionForArticle(data.articles[2], assignments), "economy");
  assert.equal(sectionForArticle(data.articles[3], assignments), "industry");
  assert.equal(defaultSection(data.articles[1]), "economy",
    "the event assignment, rather than its publisher category, changes the supporting report");
});

test("all includes every report, including those without a known reading home", () => {
  const unknown = article("unknown-source-category", "unconfigured");
  const data = crossTopicFixture();
  data.articles.push(unknown);
  const assignments = buildSectionAssignments(data);
  assert.equal(data.articles.filter((item) => matchesSection(item, "all", assignments)).length,
    data.articles.length);
  assert.equal(sectionForArticle(unknown, assignments), null);
  assert.equal(readingSections.some((section) => matchesSection(unknown, section.id, assignments)), false);
});

test("retained reviewed snapshots keep their editorial home after raw entries disappear", () => {
  const retained = article("retained-cook-inquiry", "us", ["world"]);
  const data = {
    articles: [],
    attention: { items: [event(retained, "economy")] },
  };
  const assignments = buildSectionAssignments(data);
  const [agendaItem] = attentionArticles(data);
  assert.equal(agendaItem.id, retained.id);
  assert.equal(matchesSection(agendaItem, "economy", assignments), true);
  assert.equal(matchesSection(agendaItem, "politics", assignments), false);
  assert.equal(matchesSection(agendaItem, "all", assignments), true);
});

test("unknown source categories are not classified using title or related-topic keywords", () => {
  const unknown = {
    ...article("uncategorized", "new-source-category", ["economy", "world", "industry"]),
    title: "Central bank, election, UN climate emergency and technology market news",
  };
  const assignments = buildSectionAssignments({ articles: [unknown] });
  assert.equal(defaultSection(unknown), null);
  assert.equal(sectionForArticle(unknown, assignments), null);
  assert.equal(readingSections.some((section) => matchesSection(unknown, section.id, assignments)), false);
});

test("valid editorial article homes override defaults while invalid values fall back safely", () => {
  const cook = { ...article("cook", "us"), attention: { readingSection: "economy" } };
  const invalid = { ...article("invalid", "world"), attention: { readingSection: "unrecognized-desk" } };
  const topLevel = { ...article("top-level", "world"), readingSection: "industry" };
  assert.equal(defaultSection(cook), "economy");
  assert.equal(defaultSection(invalid), "politics");
  assert.equal(defaultSection(topLevel), "industry");
});

test("desk counts use unread active canonical events without recounting supporting reports", () => {
  const data = crossTopicFixture();
  data.attention.items[1].isRead = true;
  data.attention.items[3].active = false;
  const assignments = buildSectionAssignments(data);
  const agenda = attentionArticles(data);
  assert.equal(agenda.length, 6);
  assert.equal(agenda.some((item) => item.id === "press-supporting-report"), false);
  const counts = sectionCounts(agenda, assignments);
  assert.deepEqual(counts, { politics: 1, economy: 0, development: 2, industry: 1 });
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0),
    agenda.filter((item) => !item.isRead && item.attention.active).length);
});
