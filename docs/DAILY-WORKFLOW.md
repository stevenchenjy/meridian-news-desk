# Daily Codex workflow

This workflow can be run manually or scheduled at **08:00 America/New_York** after creating your own local Codex task. Cloning the repository does not create that task. Read [ANALYSIS-POLICY.md](ANALYSIS-POLICY.md) and [ATTENTION-POLICY.md](ATTENTION-POLICY.md), and use [briefing-schema.json](../config/briefing-schema.json). The schedule follows Eastern daylight saving time; a local run still depends on the computer, Codex, network and project being available.

The observable outcome is a bilingual stream and a ranked reading agenda that retains important unread events. A daily run does not require a fixed number of new stories. The Daily briefing contains reviewed events and objective analysis; the News stream contains the full collection with separate labels for translated source text and reviewed analysis.

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

Research in this order: pending reader analysis requests; meaningful updates to continuing important events; high-priority unreviewed candidates; and due re-reviews of important events across the rolling month. Then consider lower-priority developments that add useful context. Check all the user's topic lenses, without forcing category or novelty quotas.

Group reports of the same event under a stable `eventKey`. Do not treat each source, syndicated copy or liveblog timestamp as an event. A liveblog can contain several distinct developments: specify which claim the assessment covers and use a more focused article where available.

For each researched article, open the reporting and check the headline's central claim against primary evidence and independent coverage where available. Inspect publication and event dates. Record unavailable full text or original records explicitly. Write complete matching English/Chinese `summary`, `context`, `implications`, `uncertainty`, `watch` and real `evidence`. Every newly authored major reviewed event must explain the actors and background before its latest development. Preserve the scope of the evidence and label interpretation.

Assess editorial `importance` from 0–100, bilingual `reason`, `horizonDays` from 1–30 and `keepUntilRead`. The review horizon starts from the priority assessment time, independently of the factual `analyzedAt`; revisiting an older event’s priority must not silently change when its facts were checked. Scores at or above 75 are held until the reader marks the event read. A score increase or new material-update key requires fresh checked evidence and a revised rationale; age, engagement or another copy alone is insufficient. A horizon means when to re-review; it does not imply resolution or delete an important unread event.

Keep `updateKey` unchanged when the assessed facts are the same. Change it only for a reviewed material development supported by evidence. Do not generate a new key from today's date, a changed timestamp, spelling correction, liveblog counter or minor excerpt change. A changed material key reopens a read event; source content changing alone should only trigger re-review. When several article overlays share one event, give them the same current `updateKey`, importance, horizon and keep-until-read policy; the importer rejects conflicting versions rather than letting an older report overwrite the current event.

The top reading agenda can continue to include yesterday's important events. Do not replace them with weak new stories to make the page look fresh. General English and Chinese overviews should explain ongoing priorities and real changes. Keep collection counts, feed age, failed connections and other pipeline status in **Sources & status** and the run report. Include an article-specific evidence limit in the news narrative when it changes the meaning of that story.

Write for someone learning about the subject. Start with who the actors are, what an unfamiliar institution does, and why the issue exists. Explain an acronym on first use. Then describe the latest development, its date and its practical significance. For example, explain that the FOMC is the US central bank's rate-setting committee before giving a rate change; explain what an aid route supplies before saying it is blocked. Research missing background rather than guessing a cause or motive.

Use short paragraphs and concrete verbs. English and Chinese should convey the same claims, while the Chinese reads naturally rather than copying English word order or strings of abstract nouns. Preserve dates, estimates and allegation qualifiers. A future jobs forecast is not today's unemployment count, and an older rate decision does not establish today's rate. Keep the topic's background distinct from the latest fact so a reader can understand both.

## 4. Save and apply complete reviewed analysis

Prepare `data/briefing-input.json` using the schema. The brief can contain 1–12 distinct significant developments, without a target quota of new items. The dashboard's persistent attention list can also retain events from earlier briefings. Include a full article overlay and attention assessment for every selected item so it appears in the ranked dashboard; its English and Chinese summaries must match exactly. Non-selected additional reviewed overlays may omit attention and can fulfill queue requests without forcing every item into the overview.

```json
{
  "collectionGeneratedAt": "COPY dashboard.generatedAt EXACTLY",
  "briefing": {
    "title": {"en": "World briefing · YYYY-MM-DD", "zh": "世界简报 · YYYY-MM-DD"},
    "overview": {"en": "Ongoing priorities, substantive changes and evidence limits.", "zh": "持续重点、实质性进展及证据局限的综合概述。"},
    "sectionNotes": {
      "world": [{
        "title": {"en": "A short, specific topic heading", "zh": "简短具体的主题标题"},
        "background": {"en": "Explain the actors, their role and the issue using checked evidence.", "zh": "依据已核查证据，说明参与者、机构作用和事件背景。"},
        "summary": {"en": "State the latest development, its date and why it matters.", "zh": "说明最新进展、发生日期及其重要意义。"},
        "articleIds": ["EXISTING_REVIEWED_ARTICLE_ID_IN_WORLD"]
      }]
    },
    "items": [{
      "articleId": "EXISTING_ARTICLE_ID",
      "summary": {"en": "Reviewed facts or clearly attributed claims.", "zh": "经核查的事实或明确归属的说法。"},
      "whyItMatters": {"en": "Interpretation of significance.", "zh": "重要意义的分析。"},
      "uncertainty": {"en": "Specific unresolved evidence.", "zh": "具体尚未解决的证据问题。"},
      "watch": {"en": "Observable next indicators.", "zh": "接下来可观察的指标。"},
      "evidence": [{"label": "Actual checked source", "url": "https://ACTUAL_CHECKED_SOURCE_URL"}]
    }]
  },
  "articles": [{
    "articleId": "EXISTING_ARTICLE_ID",
    "summary": {"en": "Reviewed facts or clearly attributed claims.", "zh": "经核查的事实或明确归属的说法。"},
    "analysis": {
      "context": {"en": "Established context.", "zh": "已确立的背景。"},
      "implications": {"en": "Labeled interpretation.", "zh": "明确标注的分析。"},
      "uncertainty": {"en": "Specific limits.", "zh": "具体局限。"},
      "watch": {"en": "Observable next indicators.", "zh": "接下来可观察的指标。"},
      "evidence": [{"label": "Actual checked source", "url": "https://ACTUAL_CHECKED_SOURCE_URL"}]
    },
    "attention": {
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

`briefing.sectionNotes` is optional so older inputs remain valid. Its allowed topic keys are `all`, `us`, `world`, `economy`, `crisis`, `sdg` and `industry`. Supply one to three notes for each supported topic and omit unsupported keys instead of sending empty arrays. Each note requires bilingual `title` and `summary`, plus one to twelve unique `articleIds`. Include bilingual `background` in newly authored notes; it is optional only for compatibility with older notes. The global `all` scope may draw on any reviewed topic. Every ID in another scope must match that article's `category` or `relatedCategories`.

Note references must have complete current reviewed analysis or a retained reviewed snapshot. Source excerpts alone cannot substantiate an edited analysis note. The title is limited to 120 characters per language. Each `background` and `summary` is separately limited to 75 English words and 650 English characters, 180 Chinese characters, and two paragraphs per language. Aim for 20–40 English words and 40–90 Chinese characters for each block, with enough explanation to orient a new reader. These are readability limits, not a reason to remove essential context or qualifications.

For a missing topic note, the dashboard derives notes from the stories visible in that selection, using existing bilingual summaries and reviewed context where available. It does not reuse an unrelated global overview. Saved-story and search notes are likewise limited to their matching stories. A raw source summary remains source text, and unavailable background stays unavailable. Older notes without an explicit `background` can use their linked reviewed article's context.

The import validates keys, text bounds, bilingual completeness, known reviewed IDs, topic membership and snapshot identity. These checks do not establish that a background explanation is true, that a source supports it, or that a prediction is reliable. The author must check the evidence. Editing a topic note is not a new factual review and must not reset an article's `analyzedAt`.

Replace all placeholders. Evidence lists must include each original article's exact URL, plus primary and independent pages actually checked. Do not attach analysis to a changed article without reassessing its content. An identical copied factual analysis preserves its original `analyzedAt` and factual `collectionGeneratedAt` by default. Set `reverified: true` only after actually rechecking that evidence; a new priority `reviewedAt` is a separate attention assessment. An import timestamp must still match the current collection. Retain the distinction between when facts were checked, when priority was reviewed, when the source was published and when collection ran.

```sh
.venv/bin/python scripts/apply_briefing.py --file data/briefing-input.json
```

The application validates full bilingual fields, selected item overlays, matching summaries, article IDs, evidence links and the exact collection snapshot; saves analysis and attention provenance; archives the input; and fulfills completed current queue requests. The event registry retains protected assessments and reader state independently of the current day's briefing. A newer collection invalidates the input timestamp: read and review the new snapshot rather than bypassing the mismatch.

A reader-requested due review remains pending until its factual review time is at or after the request. Copying the same analysis or extending the priority horizon does not fulfill it. Recheck the evidence and set `reverified: true` only after that work.

If there is no material change or research to apply, retain the existing attention assessments. Translating new raw excerpts alone must not masquerade as a newly researched briefing. State which stages actually completed.

## 5. Verify the actual local result

Start or check the service:

```sh
.venv/bin/python scripts/launch.py --no-open
curl --fail --silent http://127.0.0.1:4310/api/health
curl --fail --silent http://127.0.0.1:4310/api/dashboard
```

Inspect current API state and saved collection/briefing archives. Confirm collection identity; complete bilingual coverage or a precise visible gap; complete selected analysis; assessed event scores and reasons; current evidence URLs; queue completion only for fully reviewed current articles; and continuing source-failure labels.

Open `http://localhost:4310/` through browser tools and inspect both reading surfaces, the general English/Chinese priority notes, a previously raw story, an older retained attention snapshot, language controls, source status and read filtering. Switch topics and confirm the notes concern the matching stories. Check a saved-story view, a search, and an empty selection; none should display an unrelated global note. Read the background before the development in both languages and confirm that a newcomer can identify the actors and understand the issue. Check actual rendered English and Chinese context, implications, uncertainty, next indicators and evidence. Translation labels must not claim verification.

For a changed implementation or policy, verify a controlled older important unread event survives refresh and its horizon, marking read removes it from the unread agenda, marking unread restores it, a duplicate/minor edit preserves reading state, and a reviewed material update reopens it. Use tests or a temporary fixture to avoid altering the reader's real state; routine daily runs should not toggle read state merely for verification.

A raw file, frontend build, running API and rendered browser are distinct links. If any required step cannot be inspected, name that exact limit. Do not claim external publication or successful unattended execution from a local archive.

## 6. Report the completed run

Report the Eastern date, meaningful additions or material updates, ongoing retained event count, translated/collected and analyzed/collected coverage, source failures and any precise verification limit. Link the local dashboard. Notify for a materially updated completed briefing, meaningful failure or required reader action; stay quiet for unchanged non-actionable state. Never manufacture a new set of headlines or change semantic update keys merely to send a daily notification.
