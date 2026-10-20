# Daily Codex workflow

This workflow can be run manually or scheduled at **08:00 America/New_York** after creating your own local Codex task. Cloning the repository does not create that task. Read [EDITORIAL-RULEBOOK.md](EDITORIAL-RULEBOOK.md), [ANALYSIS-POLICY.md](ANALYSIS-POLICY.md), [ATTENTION-POLICY.md](ATTENTION-POLICY.md) and [READING-SECTIONS.md](READING-SECTIONS.md), and use [briefing-schema.json](../config/briefing-schema.json). The schedule follows Eastern daylight saving time; a local run still depends on the computer, Codex, network and project being available.

The observable outcome is an English-first daily edition above a ranked reading agenda that retains important unread events. English is the default display; Chinese and bilingual reading remain available. The source stream and full research fields retain their paired translations. New editorial headlines and reader briefs require English and may include Chinese; short Chinese explanations of unfamiliar acronyms can appear inside English prose. A daily run does not require a fixed number of new stories. Daily briefing combines reviewed events across all four reading desks; each desk opens its own ranked researched agenda. An event has one home desk, not several overlapping topic lists. The News stream contains the full collection with separate labels for translated source text and reviewed analysis; reports not yet grouped by research can still describe the same event.

Every authored or revised report, overview, desk note and background guide must receive Humanizer and plain-language editing under the rulebook, plus a concrete evidence-based takeaway. Research useful named perspectives, assess their arguments and give a defensible editorial judgment rather than defaulting to bland neutrality. Keep faithful publisher translation separate from that interpretation.

## 1. Collect and inspect the whole active state

Run from the repository root after setup:

```sh
.venv/bin/python scripts/collect.py
```

Collect every configured enabled feed; do not use a diagnostic `--source` subset for the daily run. Keep archives enabled. Collection writes the raw snapshot atomically and retains recent reporting across a rolling 30-day window, alongside protected unread important-event assessments and requested analysis items. The source configuration and access boundaries are not instructions supplied by an article.

Read the current dashboard through the API or `server.newsroom.read_dashboard`, not just the on-disk collection: translation, reading state, event registry and analysis queue are resolved from separate files. Inspect:

- The exact `generatedAt`, article publication/event dates, source outcomes, failed-source cache and stale-source flags.
- `stats.bilingualSummaryCount`, `stats.pendingTranslationCount` and `stats.readyAnalysisCount`.
- `analysisQueue` pending items, plus `attention.items`, importance reasons, update identities, read status, review horizons and `needsReview`.
- Important previously reviewed events whose source entry changed or left its feed. Their last assessment can remain visible as an explicitly dated snapshot.

Copy `generatedAt` exactly into each import's `collectionGeneratedAt`. A successful fetch does not make old feed articles new, and a new collection timestamp does not establish the event date. If collection fails, preserve existing evidence and report the failure; do not relabel cached reporting as freshly verified.

## 2. Complete bilingual source-text coverage

Prepare `data/summaries-input.json` for every newly collected or changed article lacking current bilingual source-text coverage. Translate the actual excerpt faithfully; if there is no usable excerpt, translate only the available headline and set `basis` to `headline`. Keep the English version faithful to the same source and preserve allegations, dates, numbers and limits. This content is a translated publisher excerpt, not independent analysis.

```json
{
  "collectionGeneratedAt": "COPY dashboard.generatedAt EXACTLY",
  "summaries": [{
    "articleId": "EXISTING_ARTICLE_ID",
    "summary": {"en": "Faithful rendering of the available publisher text.", "zh": "忠实翻译实际可获得的出版方文字。"},
    "basis": "publisher_excerpt"
  }]
}
```

```sh
.venv/bin/python scripts/apply_summaries.py --file data/summaries-input.json
```

Unchanged translations survive refresh by content fingerprint. Changed input invalidates the old translation until reviewed and reimported. The import must not grant analyzed status. Do not declare bilingual coverage complete unless the live API shows `bilingualSummaryCount == articleCount` and `pendingTranslationCount == 0`. If this stage is incomplete, the dashboard and run report must name the remaining gap.

## 3. Build the attention agenda and research it

Research in this order: pending reader analysis requests; meaningful updates to continuing important events; high-priority unreviewed candidates; and due re-reviews of important events across the rolling month. Then consider lower-priority developments that add useful context. Check the full coverage remit, without forcing desk or novelty quotas. A desk may have no researched items if no suitable event has been reviewed.

Group reports of the same event under a stable `eventKey`. Assign one `attention.readingSection` to that event: `politics`, `economy`, `development` or `industry`. Every member report must use the same assignment. Choose the assessment's central question, not every subject the report mentions. `relatedCategories` describes a report but does not add reading-desk membership. Use the [desk boundaries and examples](READING-SECTIONS.md) when a political, financial or humanitarian angle could overlap. Do not treat each source, syndicated copy or liveblog timestamp as an event. A liveblog can contain several distinct developments: specify which claim the assessment covers and use a more focused article where available.

For each researched article, open the reporting and check the headline's central claim against primary evidence and independent coverage where available. Inspect publication and event dates. Record unavailable full text or original records explicitly. Research relevant commentators, practitioners, affected groups and decision-makers where their views explain the issue. Record their names, roles, actual arguments and checked source URLs; compare the strongest credible challenge where it materially affects the conclusion. Do not force a dispute or a fixed number of parties. Write complete matching English/Chinese `summary`, `context`, `implications`, `uncertainty`, `watch` and real `evidence`. Give a concrete takeaway, explain its mechanism and identify what future evidence would strengthen or weaken it. Preserve the scope of the evidence and label interpretation.

Assess editorial `importance` from 0–100, bilingual `reason`, `horizonDays` from 1–30 and `keepUntilRead`. The review horizon starts from the priority assessment time, independently of the factual `analyzedAt`; revisiting an older event’s priority must not silently change when its facts were checked. Scores at or above 75 are held until the reader marks the event read. A score increase or new material-update key requires fresh checked evidence and a revised rationale; age, engagement or another copy alone is insufficient. A horizon means when to re-review; it does not imply resolution or delete an important unread event.

Keep `updateKey` unchanged when the assessed facts are the same. Change it only for a reviewed material development supported by evidence. Do not generate a new key from today's date, a changed timestamp, spelling correction, liveblog counter or minor excerpt change. A changed material key reopens a read event; source content changing alone should only trigger re-review. When several article overlays share one event, give them the same current `updateKey`, reading section, importance, horizon and keep-until-read policy; the importer rejects conflicting versions rather than letting an older report overwrite the current event.

The top reading agenda can continue to include yesterday's important events. Do not replace them with weak new stories to make the page look fresh. General English and Chinese overviews should explain ongoing priorities and real changes. Keep collection counts, feed age, failed connections and other pipeline status in **Sources & status** and the run report. Include an article-specific evidence limit in the news narrative when it changes the meaning of that story.

Write for someone learning about the subject. Lead with the consequential development or takeaway, give brief orientation to unfamiliar actors, then develop the detail. Explain an acronym on first use. For example, explain that the FOMC is the US central bank's rate-setting committee when introducing a rate decision; explain what an aid route supplies when introducing its closure. Research missing background rather than guessing a cause or motive. A newcomer should understand the opening without first reading a long historical account.

Use short paragraphs and concrete verbs. English and Chinese should convey the same claims, while the Chinese reads naturally rather than copying English word order or strings of abstract nouns. Preserve dates, estimates and allegation qualifiers. A future jobs forecast is not today's unemployment count, and an older rate decision does not establish today's rate. Keep the topic's background distinct from the latest fact so a reader can understand both.

Maintain the [background library](BACKGROUND-GUIDES.md) as part of this same daily research run. Its scope follows the actual reporting across all four desks, including important new topics and recurring unfamiliar subjects. Recheck material changes to existing guides, research missing actors, institutions, mechanisms and history, and add or revise complete bilingual guides. A historical guide is not evidence for a later government position, ceasefire or legal outcome. Read each coverage date and preserve factual dates unless the evidence was actually rechecked. Save updates through `scripts/apply_background.py`; runtime research is separate from application source and does not need a frontend rebuild. Feed collection alone does not verify or rewrite guides.

Before preparing either research import, apply the rulebook's editorial check to each authored report and both languages. Put fuller sourced perspectives and the desk's assessment in existing `analysis.implications`, and the short takeaway in `whyItMatters`; do not add unsupported schema fields. Apply Humanizer's draft, audit and final revision internally. Preserve facts and qualifications, use natural Chinese and remove filler. A copied report or an unchanged factual date is not evidence that this editing or source review occurred.

### Edit the reading layer

Give each newly reviewed event a concrete `analysis.headline` and a self-contained `analysis.readerBrief`, shared consistently by its member reports when their assessments concern the same factual development. English is required; Chinese is optional. Aim for a 6–14-word headline and an 80–140-word reader brief in two short paragraphs. The opening states a dated change and introduces unfamiliar actors. The rest explains who is affected, how the change works and the supported editorial assessment. Keep an allegation, estimate, dated limit or decisive uncertainty next to the claim it qualifies. Retain the deeper arguments, competing voices, uncertainty, watch indicators and evidence in the full analysis.

Write an edition title with a concrete reading promise rather than a list of abstract themes. The overview should introduce the leading developments with natural transitions; it need not invent one shared explanation for unrelated news. Notes prioritize material changes that reward explanation, while the continuing agenda keeps older important events accessible. Include worthwhile stories about work, consumer costs, housing, healthcare or everyday technology when there is a supported development; impose no topic, novelty or entertainment quota. Do not rewrite every lead into the same "cannot establish" formula. Explain what the evidence does support.

## 4. Save and apply complete reviewed analysis

Prepare `data/briefing-input.json` using the schema. The brief can contain 1–12 distinct significant developments, without a target quota of new items. The dashboard's persistent attention list can also retain events from earlier briefings. Include a full article overlay and attention assessment for every selected item so it appears in the ranked dashboard; its English and Chinese summaries must match exactly. Non-selected additional reviewed overlays may omit attention and can fulfill queue requests without forcing every item into the overview.

```json
{
  "collectionGeneratedAt": "COPY dashboard.generatedAt EXACTLY",
  "briefing": {
    "title": {"en": "World briefing · YYYY-MM-DD", "zh": "世界简报 · YYYY-MM-DD"},
    "overview": {"en": "Leading developments, what the evidence means and the main limit on that assessment.", "zh": "主要进展、证据说明了什么，以及判断的主要局限。"},
    "sectionNotes": {
      "politics": [{
        "title": {"en": "A short, specific topic heading", "zh": "简短具体的主题标题"},
        "background": {"en": "Explain the actors, their role and the issue using checked evidence.", "zh": "依据已核查证据，说明参与者、机构作用和事件背景。"},
        "summary": {"en": "State the development, its date and a concrete evidence-based takeaway.", "zh": "说明进展、发生日期，以及有证据支持的具体判断。"},
        "articleIds": ["EXISTING_REVIEWED_ARTICLE_ID_IN_POLITICS"]
      }]
    },
    "items": [{
      "articleId": "EXISTING_ARTICLE_ID",
      "summary": {"en": "Reviewed facts or clearly attributed claims.", "zh": "经核查的事实或明确归属的说法。"},
      "whyItMatters": {"en": "A concrete takeaway and the mechanism supporting it.", "zh": "具体判断及其成立的作用机制。"},
      "uncertainty": {"en": "Specific unresolved evidence.", "zh": "具体尚未解决的证据问题。"},
      "watch": {"en": "An observable result that would strengthen or weaken the takeaway, and why.", "zh": "哪些可观察结果会支持或削弱这一判断，以及原因。"},
      "evidence": [{"label": "Actual checked source", "url": "https://ACTUAL_CHECKED_SOURCE_URL"}]
    }]
  },
  "articles": [{
    "articleId": "EXISTING_ARTICLE_ID",
    "summary": {"en": "Reviewed facts or clearly attributed claims.", "zh": "经核查的事实或明确归属的说法。"},
    "analysis": {
      "headline": {"en": "A concrete change or question the report explains"},
      "readerBrief": {"en": "The dated consequential change and the actors a newcomer needs to know.\n\nThe mechanism, affected people and a bounded editorial assessment supported by the full analysis."},
      "context": {"en": "Established context.", "zh": "已确立的背景。"},
      "implications": {"en": "Useful named sourced views, the strongest credible challenge and a reasoned editorial assessment.", "zh": "有来源的具名观点、最有力的合理质疑，以及有依据的编辑判断。"},
      "uncertainty": {"en": "Specific limits.", "zh": "具体局限。"},
      "watch": {"en": "An observable result that would strengthen or weaken the assessment, and why.", "zh": "哪些可观察结果会支持或削弱这一判断，以及原因。"},
      "evidence": [{"label": "Actual checked source", "url": "https://ACTUAL_CHECKED_SOURCE_URL"}]
    },
    "attention": {
      "readingSection": "politics",
      "importance": 78,
      "reason": {"en": "Evidence-based importance and horizon rationale.", "zh": "基于证据的重要性与复核周期理由。"},
      "horizonDays": 30,
      "keepUntilRead": true,
      "eventKey": "stable-semantic-event-key",
      "updateKey": "stable-semantic-material-development-key"
    }
  }]
}
```

`briefing.sectionNotes` is optional so older inputs remain valid. New notes use `all`, `politics`, `economy`, `development` and `industry`. Supply one to three notes for each supported scope and omit unsupported keys instead of sending empty arrays. Each note requires bilingual `title` and `summary`, plus one to twelve unique `articleIds`. Include bilingual `background` in newly authored notes; it is optional only for compatibility with older notes. The global `all` scope may draw on any reviewed desk. Other scopes must reference events assigned to that one desk, so a note cannot reintroduce a repeated event through a related topic label.

Older `us`, `world`, `crisis` and `sdg` scopes remain accepted for input compatibility. Existing assessments without an explicit reading section also remain supported, using the primary-category fallback described in [Reading sections](READING-SECTIONS.md). This fallback organizes old content; newly authored event assessments must include the editorial assignment. For the shared `economy` and `industry` note keys, older inputs without an explicit reading section retain the earlier category/related-category validation; an explicit assignment takes precedence. The interface still gives each event only one desk.

Note references must have complete current reviewed analysis or a retained reviewed snapshot. Source excerpts alone cannot substantiate an edited analysis note. The title is limited to 120 characters per language. Each `background` and `summary` is separately limited to 75 English words and 650 English characters, 180 Chinese characters, and two paragraphs per language. Aim for 20–40 English words and 40–90 Chinese characters for each block, with enough explanation to orient a new reader. These are readability limits, not a reason to remove essential context or qualifications.

For a missing desk note, the dashboard derives notes from the stories visible in that selection, using existing bilingual summaries and reviewed context where available. It does not reuse an unrelated global overview. Saved-story and search notes are likewise limited to their matching stories. A raw source summary remains source text, and unavailable background stays unavailable. Older notes without an explicit `background` can use their linked reviewed article's context.

The import validates keys, text bounds, bilingual completeness, known reviewed IDs, applicable scope membership, consistent event assignments and snapshot identity. These checks do not establish that a background explanation is true, that a source supports it, or that a prediction is reliable. The author must check the evidence. Editing a desk note or changing a reading-section assignment is not a new factual review and must not reset an article's `analyzedAt`.

Replace all placeholders. Evidence lists must include each original article's exact URL, plus primary and independent pages actually checked. Do not attach analysis to a changed article without reassessing its content. An identical copied factual analysis preserves its original `analyzedAt` and factual `collectionGeneratedAt` by default. Set `reverified: true` only after actually rechecking that evidence; a new priority `reviewedAt` is a separate attention assessment. An import timestamp must still match the current collection. Retain the distinction between when facts were checked, when priority was reviewed, when the source was published and when collection ran.

```sh
.venv/bin/python scripts/apply_briefing.py --file data/briefing-input.json
```

For an editorial rewrite of already reviewed content, prepare a separate payload with the exact current `collectionGeneratedAt`, `articles: [{articleId, headline: {en, zh?}, readerBrief: {en, zh?}}]`, and optional `briefing` edits limited to the existing bilingual `title`, `overview` and `sectionNotes`. Use `.venv/bin/python scripts/apply_editorial.py --file data/editorial-input.json`. This preserves the original publisher headline, factual summary, full analysis, evidence, review dates, priority, material update keys and reading state. It must not complete a factual-review request or imply fresh verification. Routine research imports preserve omitted editorial copy for the same factual version; changed facts require revised editorial copy or a clearly labeled fallback.

The application validates full bilingual fields, selected item overlays, matching summaries, article IDs, evidence links and the exact collection snapshot; saves analysis and attention provenance; archives the input; and fulfills completed current queue requests. The event registry retains protected assessments and reader state independently of the current day's briefing. A newer collection invalidates the input timestamp: read and review the new snapshot rather than bypassing the mismatch.

A reader-requested due review remains pending until its factual review time is at or after the request. Copying the same analysis or extending the priority horizon does not fulfill it. Recheck the evidence and set `reverified: true` only after that work.

If there is no material change or research to apply, retain the existing attention assessments. Translating new raw excerpts alone must not masquerade as a newly researched briefing. State which stages actually completed.

## 4a. Maintain background for the same news snapshot

Read the live `background.guides` alongside all current and retained priority events and the broader retained stream. Cover the actual subjects, not a fixed list of examples. Reuse durable guides, add new topics when the reader needs an unfamiliar actor or mechanism explained, and update history or stated positions only against checked evidence. Prioritize a useful substantive match for every priority event; a passing keyword match alone is not proof the explanation is adequate. Review recurring subjects across all four desks without creating one repetitive guide per article. Record any important topic or evidence gap that remains.

Prepare `data/background-input.json` with the exact current `collectionGeneratedAt` and an array of complete `guides` following [Background guides](BACKGROUND-GUIDES.md). Use `reverified: true` only for a batch whose facts were actually rechecked; copied explanations and metadata edits preserve their original factual dates. An empty guide batch can record a genuine no-change maintenance pass without pretending all historical facts were checked again. Omitted topics remain in the library.

```sh
.venv/bin/python scripts/apply_background.py --file data/background-input.json
```

The importer validates references and bilingual content, rejects stale snapshot identity while holding the storage lock, writes atomically and archives the input. The API merges persisted daily additions and overrides with bundled starting guides on every read. No application source change, rebuild or server restart is needed for ordinary background research. The open dashboard receives updates on its next poll or reload. An import validates structure; the author must still verify factual support and actual rendered clarity. If evidence is unavailable, retain the last checked explanation with its actual date and report the material gap.

## 5. Verify the actual local result

Start or check the service:

```sh
.venv/bin/python scripts/launch.py --no-open
curl --fail --silent http://127.0.0.1:4310/api/health
curl --fail --silent http://127.0.0.1:4310/api/dashboard
```

Inspect current API state and saved collection/briefing archives. Confirm collection identity; complete bilingual coverage or a precise visible gap; complete selected analysis; assessed event scores and reasons; current evidence URLs; queue completion only for fully reviewed current articles; and continuing source-failure labels.

Open `http://localhost:4310/` through browser tools and inspect the English-first daily edition, continuing agenda, scoped notes, a previously raw story, an older retained attention snapshot, language controls, source status and read filtering. Switch all four reading desks and confirm their notes concern the matching events. With the same read filter, compare event IDs: no event should appear in two desks, and the desks together should cover the corresponding overall researched agenda. Check a report with related categories and a multi-report event. Confirm sidebar desk links open the researched agenda rather than the full publisher stream. Check a saved-story view, a search, and an empty selection; none should display an unrelated global note. Read the opening, orientation and analysis in both languages: a newcomer should be able to explain what changed, who is affected and why the takeaway follows. Check useful named perspectives against their sources and confirm the watch indicator could test the judgment. Inspect actual rendered context, implications, uncertainty, next indicators and evidence, including paragraph readability and usable links. Translation labels must not claim verification.

When changing the background library or its discovery logic, also inspect the standalone guide, actor positions, expanded timeline and terms, source links and coverage/review dates in English, Chinese and bilingual modes. Exercise a related article → guide → return-to-reading path. Related links must concern the visible selection; an empty saved list or unrelated search must not acquire arbitrary suggestions. Check the built dashboard on desktop and a narrow screen. The guide remains readable even without a matching collected article.

For a changed implementation or policy, verify a controlled older important unread event survives refresh and its horizon, marking read removes it from the unread agenda, marking unread restores it, a duplicate/minor edit preserves reading state, and a reviewed material update reopens it. Use tests or a temporary fixture to avoid altering the reader's real state; routine daily runs should not toggle read state merely for verification.

A raw file, frontend build, running API and rendered browser are distinct links. If any required step cannot be inspected, name that exact limit. Do not claim external publication or successful unattended execution from a local archive.

## 6. Report the completed run

Report the Eastern date, meaningful additions or material updates, background guides added or materially revised and any important uncovered topic, ongoing retained event count, translated/collected and analyzed/collected coverage, source failures and any precise verification limit. Link the local dashboard. Notify for a materially updated completed briefing, meaningful failure or required reader action; stay quiet for unchanged non-actionable state. Never manufacture a new set of headlines or change semantic update keys merely to send a daily notification.
