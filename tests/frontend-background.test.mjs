import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  matchingBackgroundGuides,
  relatedBackgroundGuides,
  filterBackgroundGuides,
} from "../src/lib/background.js";

const pair = (en, zh = "") => ({ en, zh });
const israel = {
  id: "israel-palestine",
  title: pair("Israel, Palestinians and the United States", "以色列、巴勒斯坦与美国"),
  subtitle: pair("Actors, positions and the conflict's history", "参与者、立场与冲突历史"),
  keywords: ["Israel", "Gaza", "Palestinian", "以色列", "加沙", "巴勒斯坦"],
  overview: pair("Read the background to ceasefire negotiations.", "了解停火谈判的背景。"),
  actors: [{ name: pair("Palestinian Authority", "巴勒斯坦民族权力机构") }],
  terms: [{ term: pair("Two-state solution", "两国方案"), meaning: pair("A proposed political settlement.") }],
  sources: [{ title: "Unrelated source metadata", publisher: "Iran Journal", url: "https://example.org/iran" }],
};
const iran = {
  id: "iran-us",
  title: pair("Iran and the United States", "伊朗与美国"),
  subtitle: pair("Nuclear talks and regional security", "核谈判与地区安全"),
  keywords: ["Iran", "Iranian", "Strait of Hormuz", "伊朗", "霍尔木兹海峡"],
  overview: pair("The dispute includes uranium enrichment.", "争议包括铀浓缩。"),
  actors: [{ name: pair("International Atomic Energy Agency", "国际原子能机构") }],
  terms: [{ term: pair("JCPOA", "伊核协议") }],
};
const trump = {
  id: "trump-administration",
  title: pair("Understanding the Trump administration", "理解特朗普政府"),
  subtitle: pair("Institutions and policy", "制度与政策"),
  keywords: ["Donald Trump", "Trump administration", "特朗普", "川普"],
  overview: pair("Executive power, Congress and the courts.", "行政权、国会与法院。"),
  actors: [{ name: pair("Donald Trump", "唐纳德·特朗普") }],
  terms: [{ term: pair("Executive order", "行政命令") }],
};
const guides = [israel, iran, trump];
const ids = (items) => items.map(item => item.id);
const configDirectory = new URL('../config/', import.meta.url);
const authoredGuides = readdirSync(configDirectory).filter(name => /^background-.*\.json$/.test(name)).map(name => JSON.parse(
  readFileSync(new URL(name, configDirectory), 'utf8'),
));

function assertPair(value, label) {
  for (const language of ["en", "zh"]) {
    assert.equal(typeof value?.[language], "string", `${label}.${language} is text`);
    assert.ok(value[language].trim(), `${label}.${language} is not empty`);
  }
}

function dateStart(value, label, allowPartial = false) {
  const pattern = allowPartial ? /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/ : /^\d{4}-\d{2}-\d{2}$/;
  assert.match(value, pattern, `${label} uses an ISO date`);
  const complete = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value;
  const parsed = new Date(`${complete}T00:00:00Z`);
  assert.ok(Number.isFinite(parsed.valueOf()), `${label} is a valid date`);
  assert.equal(parsed.toISOString().slice(0, 10), complete, `${label} is a calendar date`);
  return parsed.valueOf();
}

test("article discovery reads each supported English and Chinese content field", () => {
  const articles = [
    { title: "Talks on GAZA resume" },
    { excerpt: "Officials discussed Israel's position." },
    { summary: pair("No keyword in English", "加沙停火谈判仍在继续。") },
    { analysis: { context: pair("The Iranian nuclear dispute has a long history.") } },
    { analysis: { context: pair("No keyword in English", "伊朗与美国的关系长期紧张。") } },
    { attention: { reason: pair("A Donald Trump policy shift affects the talks.") } },
    { attention: { reason: pair("No keyword in English", "特朗普政府改变了政策。") } },
  ];
  assert.deepEqual(articles.map(article => ids(matchingBackgroundGuides(article, guides))), [
    [israel.id], [israel.id], [israel.id], [iran.id], [iran.id], [trump.id], [trump.id],
  ]);
});

test("matching respects Latin words, punctuation and diacritics without substring bleed", () => {
  assert.deepEqual(ids(matchingBackgroundGuides({ title: "IRÁN: Strait-of-Hormuz talks" }, guides)), [iran.id]);
  assert.deepEqual(ids(matchingBackgroundGuides({ title: "Trump—administration's position on Gaza" }, guides)),
    [israel.id, trump.id]);
  assert.deepEqual(matchingBackgroundGuides({ title: "Tirana and the trumpeter hold a concert" }, guides), []);
  assert.deepEqual(matchingBackgroundGuides({ title: "Iran2 and preIran are product names" }, guides), []);
  assert.deepEqual(matchingBackgroundGuides({ title: "The United States economy is growing" }, guides), [],
    "a broad country label does not assume a particular geopolitical dispute");
});

test("publisher identity, URLs, evidence and unrelated analysis fields cannot create a topic match", () => {
  const article = {
    title: "A new railway opens in Tirana",
    excerpt: "The route connects two cities.",
    sourceName: "Iran News / Israel Today / Trump Journal",
    sourceId: "iran",
    url: "https://example.org/gaza-iran-trump",
    category: "Iran",
    relatedCategories: ["Israel"],
    analysis: {
      evidence: [{ label: "Iran", url: "https://example.org/Israel" }],
      watch: pair("Donald Trump"),
      implications: pair("Gaza"),
    },
  };
  assert.deepEqual(matchingBackgroundGuides(article, guides), []);
  assert.deepEqual(relatedBackgroundGuides([article], guides), []);
});

test("empty and unrelated scopes show no suggested guides while the library stays available", () => {
  assert.deepEqual(matchingBackgroundGuides({}, guides), []);
  assert.deepEqual(relatedBackgroundGuides([], guides), []);
  assert.deepEqual(relatedBackgroundGuides([{ title: "Local rainfall forecast" }], guides), []);
  assert.deepEqual(relatedBackgroundGuides([{ title: "Gaza talks" }], guides, 0), []);
  assert.deepEqual(matchingBackgroundGuides({ title: "Iran talks" }, []), []);
  assert.deepEqual(filterBackgroundGuides(guides, "  "), guides);
});

test("related guides rank by distinct matching articles with source-order ties", () => {
  const articles = [
    { id: "one", title: "Gaza talks; Iran responds" },
    { id: "one", title: "Gaza talks; Iran responds" },
    { id: "two", title: "The Trump administration comments on Iran" },
    { id: "three", title: "Gaza and Iran face a policy shift" },
    { id: "four", title: "Donald Trump meets officials" },
  ];
  assert.deepEqual(ids(relatedBackgroundGuides(articles, guides)), [iran.id, israel.id, trump.id]);
  assert.deepEqual(ids(relatedBackgroundGuides(articles, guides, 2)), [iran.id, israel.id]);
  assert.deepEqual(ids(relatedBackgroundGuides(articles, guides.slice().reverse())), [iran.id, trump.id, israel.id],
    "equal counts retain catalog order");
  assert.deepEqual(ids(guides), [israel.id, iran.id, trump.id], "ranking must not mutate the catalog");
});

test("duplicate appearances do not outweigh a guide matching more distinct articles", () => {
  const articles = [
    ...Array.from({ length: 5 }, () => ({ id: "retained", title: "Gaza update" })),
    { id: "iran-one", title: "Iran update" },
    { id: "iran-two", title: "Iran negotiations" },
  ];
  assert.deepEqual(ids(relatedBackgroundGuides(articles, guides)), [iran.id, israel.id]);
});

test("catalog search finds bilingual titles, subtitles, keywords, overview, actor names and glossary terms", () => {
  for (const [query, expected] of [
    ["palestinians", israel.id], ["核谈判", iran.id], ["霍尔木兹", iran.id],
    ["uranium enrichment", iran.id], ["国际原子能机构", iran.id],
    ["two state", israel.id], ["两国方案", israel.id], ["executive order", trump.id],
    ["isr", israel.id], ["IRÁN", iran.id],
  ]) {
    assert.deepEqual(ids(filterBackgroundGuides(guides, query)), [expected], query);
  }
  assert.deepEqual(filterBackgroundGuides(guides, "does not exist"), []);
  assert.deepEqual(filterBackgroundGuides(guides, "Unrelated source metadata"), [],
    "source metadata is not guide subject matter");
});

test("authored guides provide complete bilingual content, three takeaways and honest date bounds", () => {
  assert.equal(new Set(ids(authoredGuides)).size, authoredGuides.length, "guide IDs are unique");
  for (const guide of authoredGuides) {
    assert.ok(typeof guide.id === "string" && guide.id.trim(), "a guide has a stable ID");
    for (const field of ["title", "subtitle", "overview", "roots"]) {
      assertPair(guide[field], `${guide.id}.${field}`);
    }
    assert.equal(guide.takeaways.length, 3, `${guide.id} has three introductory takeaways`);
    for (const field of ["takeaways", "readingLens"]) {
      assert.ok(guide[field].length > 0, `${guide.id}.${field} is not empty`);
      guide[field].forEach((value, index) => assertPair(value, `${guide.id}.${field}[${index}]`));
    }
    for (const [field, pairs] of [
      ["actors", ["name", "role", "position"]],
      ["timeline", ["title", "detail"]],
      ["terms", ["term", "meaning"]],
    ]) {
      assert.ok(guide[field].length > 0, `${guide.id}.${field} is not empty`);
      guide[field].forEach((item, index) => {
        for (const pairField of pairs) assertPair(item[pairField], `${guide.id}.${field}[${index}].${pairField}`);
      });
    }
    const review = dateStart(guide.reviewedAt, `${guide.id}.reviewedAt`);
    const coverage = dateStart(guide.coverageThrough, `${guide.id}.coverageThrough`);
    assert.ok(coverage <= review, `${guide.id} does not cover events after its review`);
    guide.timeline.forEach((entry, index) => {
      assert.ok(dateStart(entry.date, `${guide.id}.timeline[${index}].date`, true) <= review,
        `${guide.id} timeline does not claim future history at its review date`);
    });
  }
});

test("authored source references resolve to unique, non-placeholder HTTPS citations", () => {
  for (const guide of authoredGuides) {
    assert.ok(guide.sources.length > 0, `${guide.id} has sources`);
    const sourceIds = new Set(guide.sources.map(source => source.id));
    assert.equal(sourceIds.size, guide.sources.length, `${guide.id} source IDs are unique`);
    for (const source of guide.sources) {
      for (const field of ["id", "title", "publisher", "kind", "url"]) {
        assert.ok(typeof source[field] === "string" && source[field].trim(), `${guide.id} source ${field} is present`);
      }
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:", `${guide.id}/${source.id} uses HTTPS`);
      assert.ok(!/(^|\.)(?:example\.(?:com|org|net)|localhost|invalid|test)$/i.test(url.hostname),
        `${guide.id}/${source.id} does not use an example or local host`);
      assert.doesNotMatch(`${source.id} ${source.title} ${source.url}`,
        /\b(?:TODO|TBD|placeholder|replace[ _-]?me|ACTUAL_CHECKED_SOURCE_URL|ACTUAL_SOURCE_URL)\b/i,
        `${guide.id}/${source.id} is not a placeholder citation`);
      if (source.publishedAt) {
        assert.ok(dateStart(source.publishedAt, `${guide.id}/${source.id}.publishedAt`) <=
          dateStart(guide.reviewedAt, `${guide.id}.reviewedAt`), "source publication precedes factual review");
      }
    }
    for (const field of ["actors", "timeline"]) {
      guide[field].forEach((item, index) => {
        assert.ok(Array.isArray(item.sourceIds) && item.sourceIds.length > 0,
          `${guide.id}.${field}[${index}] has claim-specific references`);
        assert.equal(new Set(item.sourceIds).size, item.sourceIds.length,
          `${guide.id}.${field}[${index}] does not repeat a source reference`);
        for (const id of item.sourceIds) {
          assert.ok(sourceIds.has(id), `${guide.id}.${field}[${index}] resolves source ${id}`);
        }
      });
    }
  }
});

test("authored guide keywords discover representative English and Chinese stories", () => {
  const titles = [
    ["Israel and Gaza: ceasefire negotiations resume", "以色列与加沙停火谈判继续"],
    ["Iran and the United States return to nuclear talks", "伊朗与美国重启核谈判"],
    ["Trump administration announces a new policy", "特朗普政府公布新政策"],
  ];
  authoredGuides.forEach(guide => {
    assert.ok(Array.isArray(guide.keywords) && guide.keywords.length > 0, `${guide.id} has discovery keywords`);
    assert.ok(guide.keywords.every(keyword => typeof keyword === "string" && keyword.trim()),
      `${guide.id} has only nonempty keyword text`);
    const starter = ['israel-palestine', 'us-iran', 'trump-administration'].indexOf(guide.id);
    const examples = starter >= 0 ? titles[starter] : [
      guide.keywords.find(keyword => /[a-z]/i.test(keyword) && !/\p{Script=Han}/u.test(keyword)),
      guide.keywords.find(keyword => /\p{Script=Han}/u.test(keyword)),
    ];
    assert.ok(examples.every(Boolean), `${guide.id} has both English and Chinese discovery terms`);
    for (const title of examples) {
      assert.ok(matchingBackgroundGuides({ title }, authoredGuides).includes(guide),
        `${guide.id} is discoverable from ${title}`);
    }
  });
});

test("authored guide keywords do not turn unrelated institutions or policy topics into these disputes", () => {
  const disputeGuides = authoredGuides.filter(guide => ['israel-palestine', 'us-iran', 'trump-administration'].includes(guide.id));
  for (const title of [
    "Biden administration publishes an archive",
    "The city administration opens a public park",
    "Congress debates local railway funding",
    "France's Republican party debates its leadership",
    "India's Supreme Court hears a local property case",
    "A Federal Reserve research paper studies rainfall",
    "Russia faces fresh sanctions over the war in Ukraine",
    "A Japanese nuclear power station reopens",
    "Officials discuss immigration and tariff paperwork",
    "英国政府调整移民政策和关税规则",
    "俄罗斯制裁与日本核电站维护计划",
  ]) {
    assert.deepEqual(matchingBackgroundGuides({ title }, disputeGuides), [], title);
  }
});

test('expanded concept guides avoid ordinary pronouns, verbs and generic guidance', () => {
  for (const [title, excluded] of [
    ['Children who were fed at a community kitchen', ['public-health-outbreaks', 'central-banks-inflation']],
    ['A museum issues visitor guidance', ['earnings-markets']],
  ]) {
    const matched = ids(matchingBackgroundGuides({ title }, authoredGuides));
    for (const id of excluded) assert.ok(!matched.includes(id), `${title} must not imply ${id}`);
  }
  const election = authoredGuides.find(guide => guide.id === 'us-elections');
  assert.ok(matchingBackgroundGuides({ title: 'Republican candidates face Senate Democrats in key races' }, [election]).length);
});
