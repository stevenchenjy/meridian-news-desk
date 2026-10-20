# Background guides and daily maintenance

The background library explains the actors, institutions, stated positions, history and vocabulary needed to read Meridian. Its scope follows the actual reporting across Politics & world, Economy & business, People & planet and Industry & technology. Israel/Gaza, US–Iran and the Trump administration are examples, not a fixed topic list. New important subjects should receive a guide when the existing library cannot explain them adequately. Several reports about the same subject usually share one guide.

Apply [Editorial rulebook](EDITORIAL-RULEBOOK.md) to every new or revised guide, including Humanizer and plain-language editing in both languages. Give a newcomer a useful takeaway, explain the mechanism and provide a reading lens that helps evaluate later headlines. Durable factual guides do not need a manufactured controversy. Keep actors' positions attributed and dated, distinguish them from the desk's assessment, and tie any judgment to the guide's historical scope and checked evidence.

Every guide is bilingual. It starts with three essentials and includes actor roles and attributed positions, historical roots, dated milestones, terms, questions for reading new headlines and checked sources. Distinguish a country, government, armed group and civilian population. For institutional topics, explain who decides what and how the mechanism works. For technology, economics and development, explain competing interests and measurement limits without inventing a conflict.

## Live content and bundled starting points

`config/background-*.json` contains the bundled starting library. Both the backend and the frontend fallback discover all these files; there is no hardcoded three-guide catalog. The primary live library comes from `GET /api/dashboard` under `background`.

Daily research is saved in ignored `data/background-guides.json`. The backend merges those persistent overrides and additions with bundled guides by stable ID on every request. Applying research does not require editing application source, a frontend rebuild or a server restart. The open dashboard polls saved state every 30 seconds; reloading reads it immediately. New topics can therefore appear during ordinary daily research. Guides remain available when their original reports leave the rolling collection, and a new news snapshot does not erase earlier background.

The API exposes `guides`, `generatedAt`, `collectionGeneratedAt`, `isStale`, `guideCount`, `dailyResearchCount` and `categoryCounts`. Each resolved guide has derived `contentOrigin` (`bundled` or `daily_research`). A malformed saved library produces a visible `loadError` while available bundled content remains readable. Do not overwrite corrupt research to conceal a load failure.

## Daily research responsibilities

During every daily news run:

1. Read the merged dashboard, retained attention events and the existing background library. Check all four desks and the full retained stream for recurring or significant subjects. Prioritize every reviewed priority event and reader request, then recurring unfamiliar subjects in the broader collection. Avoid a fixed number of guides or a daily novelty quota.
2. Identify the actual knowledge gap: an unfamiliar actor, institution, mechanism, term, historical dispute or changed position. Reuse a suitable guide; add a new stable topic when a generic or unrelated explanation would not help. Use topic-specific English and Chinese discovery keywords. A mention of a publisher or a URL does not establish topical relevance.
3. Open dated primary evidence and independent reporting where available. Recheck material developments that change existing background: leadership or stated positions, war or ceasefire developments, law and court rulings, institutional arrangements and important shifts in the mechanism. Feed excerpts are leads, not independent verification. When source access is limited, state the precise limit and retain earlier checked facts.
4. Write or revise the explanation in both languages. Preserve still-useful history and source attribution. Separate proposals, enactment, commencement, implementation and measured outcomes. Do not substitute today's headline for a background explanation. Do not assign a population the position of a government or faction.
5. Save complete new or updated guides in `data/background-input.json` for the exact current collection snapshot and apply the command below. Guides omitted from the import remain available. A no-change review may use an empty guide batch after checking the current scope; it records a completed library maintenance pass without advancing individual guide dates. Use `reverified: true` only for a batch whose evidence was actually rechecked, never as a date-refresh shortcut.
6. Inspect saved data, live API and rendered results. Confirm new topics, changed facts, both languages, source links, category filters and relevant article links. Report material remaining gaps. Include new guides and meaningful revisions in the daily run report; stay quiet for unchanged, non-actionable state.

The active local automation can perform this workflow together with the daily briefing. A configured schedule is not evidence that a future unattended run succeeded. Local execution still needs the computer, app, project and network available.

## Import shape and validation

Prepare complete guide objects using any bundled file as a shape reference:

```json
{
  "collectionGeneratedAt": "COPY CURRENT dashboard.generatedAt EXACTLY",
  "guides": [],
  "reverified": false
}
```

An empty array is valid only for a genuine no-change review; it does not research anything by itself. New or updated guide objects belong in that array. Do not include API-only fields such as `contentOrigin` in authored inputs.

```sh
.venv/bin/python scripts/apply_background.py --file data/background-input.json
```

The importer validates the complete bilingual schema, stable IDs, one reading category, three takeaways, dates, source kinds, HTTPS URLs and resolved actor/timeline source IDs. It checks the collection identity while holding the same storage lock as collection/import, rejects stale inputs before mutation, saves atomically and retains 60 import archives in `data/background-imports/`. It preserves unrelated guides and refuses to import over corrupt saved research. These structural checks do not establish factual truth or that a cited page supports the claim; that remains the research author's responsibility.

For an unchanged explanation or a metadata-only edit, the importer preserves the prior factual review and coverage dates. A changed heading, keyword or category must not make old facts appear newly checked. An actual recheck can be recorded with `reverified: true`; retain older dates when it did not occur. Source publication, historical event, news collection, library import and factual review are different dates.

Every guide has these fields: `id`, `category`, `title`, `subtitle`, `overview`, `roots`, `keywords`, `reviewedAt`, `coverageThrough`, `takeaways`, `actors`, `timeline`, `terms`, `readingLens`, `sources`. Use `{ "en": "…", "zh": "…" }` for text pairs. Categories are `politics`, `economy`, `development`, `industry`. Actor entries use paired `name`, `role`, `position`, plus `sourceIds`. Timeline entries use `date`, paired `title` and `detail`, plus `sourceIds`. Terms have paired `term` and `meaning`. Source entries have unique guide-local `id`, `title`, `publisher`, `url`, `kind` and optional exact `publishedAt`. Source kinds are `historical-record`, `institutional-position`, `independent-reporting`.

`reviewedAt` and `coverageThrough` use exact `YYYY-MM-DD`. The former records when the guide's facts were actually checked; the latter states its historical coverage boundary. Historical timeline events may retain year or month precision when that is all the source establishes. Do not invent an exact event or publication day. Omit optional `publishedAt` when its exact day is unknown. A historical guide may be checked today while deliberately describing earlier conditions; date changing positions and state the scope clearly.

## Discovery and reading scope

`src/lib/background.js` matches only reader-facing article title, excerpt, bilingual summary, reviewed context and attention reason. It ignores publisher names, URLs, feed tags and evidence labels. Latin keywords use full words/phrases with normalized punctuation; Chinese keywords match within unspaced text. Include meaningful variants explicitly. Avoid broad `US` or `美国` keywords that imply every US article concerns one dispute. Concept words such as inflation or semiconductors are useful when the guide actually explains that concept.

Related links follow the current desk, saved selection, search or article. An empty or unrelated selection must not receive arbitrary fallback links. The independent catalog remains available in all those cases. Its search covers titles, subtitles, overview, keywords, actor names and glossary terms; desk filters organize the larger library. The displayed priority-link count measures discoverability, not factual verification or the completeness of every explanation.

## Verification

Run `npm test` and `npm run build` after implementation changes. Routine research-only imports require validation and inspection, not rebuilding source. Verify an imported change reaches `/api/dashboard` and an already built browser without changing the bundle. Test stale snapshot rejection, retained unrelated guides, no-op factual dates, corrupt storage errors, new topic discovery, desk filters, bilingual detail, sources and the article → guide → return path. Inspect desktop and a narrow screen.

Source, bundled artifacts, persisted research, live API, rendered results and scheduler execution are separate evidence. Keep claims about each specific. See [Daily workflow](DAILY-WORKFLOW.md) and [Analysis policy](ANALYSIS-POLICY.md).
