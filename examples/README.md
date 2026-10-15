# Fictional dashboard examples

These two hand-authored fixtures demonstrate the reading and ranking workflow.
They are **not real news**. All titles begin with `[DEMO]`; institutions, numbers
and reserved `.example` URLs are fictional. No website, feed or AI service is
called by the demo loader, and it does not install a schedule.

| Fixture event | Publication age when loaded | Importance | Review horizon | Retention |
| --- | --- | --- | --- | --- |
| Unresolved relief corridor | 13 days | 84/100 | 30 days | Stays until marked read |
| Optional software-forum color theme | 1 hour | 18/100 | 1 day | Lower priority; normal review rules |

The older event ranks first because its fictional consequences remain important.
Mark it read to remove it from the unread agenda; its entry remains available in
the stream. A material change would require a new assessment and update key.

From a **fresh clone**, install the dependencies without collecting feeds, load
the fixture and start the local dashboard:

```sh
npm run setup -- --skip-collect
.venv/bin/python scripts/seed_demo.py
npm start
```

Open `http://localhost:4310/`. Dependency installation requires internet access;
the seeded demo itself works without a Codex account, AI credentials or feeds.

The loader refuses **any existing local data**, including bookmarks and reading
state. There is no force or reset flag. Use a fresh copy for this demo. For an
isolated validation directory, use `--workspace /path/to/an/empty/directory`.
The option only changes where fixture data is written; it does not copy the app.

The inputs are ordinary application contracts:

- [demo-snapshot.json](demo-snapshot.json) contains two raw fictional articles and a `synthetic_demo` collection marker. Its reference timestamp is October 14, 2026.
- [demo-summaries.json](demo-summaries.json) supplies matching English and Simplified Chinese source summaries, with `publisher_excerpt` provenance.
- [demo-briefing.json](demo-briefing.json) supplies full bilingual sample analysis and attention assessments, including stable event and material-update keys.

The briefing also includes short bilingual `sectionNotes`: two notes for the
global view, one for Crisis and one for Industry. Each note names its supporting
article IDs and separates background from the latest development. The background
defines the relief corridor or forum theme before explaining what changed. It
does not invent a cause for the fictional corridor closure. The other topic keys
are deliberately omitted, so their empty-state
behavior can be checked without recycling the global note into an unrelated tab.

`seed_demo.py` rebases the example dates to the load time, stages the files, and
calls the real summary and briefing importers. Their timestamp fields describe
fixture loading in this demo, **not a factual verification or an AI run**. No
actual claim is substantiated by a `.example` link. The production input
validators run before the staged data is installed atomically.

To move to live reporting, use the normal collection command documented in the
project README. A first real collection replaces the synthetic demo state; it
does not carry the fictional held event into your real reading agenda.

The fictional aid event has one editorial `readingSection`: `development`. The cosmetic forum update belongs to `industry`. Their source-feed categories remain unchanged; the sidebar opens the researched agenda for each desk. Legacy source-topic keys remain supported for older imports.
