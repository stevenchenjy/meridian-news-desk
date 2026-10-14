# Historical pipeline audit · 14 October 2026

This document records one local installation inspected on **14 October 2026**. Its article counts, feed outcomes, browser checks and scheduler receipt describe that historical snapshot. They are not a current feed report, a guarantee about another installation, or data shipped with this repository. A fresh clone contains application source and synthetic examples; each reader must collect their own reporting, author or obtain researched overlays, and configure their own scheduler.

The reported gaps were real pipeline behavior. The collection at the start of that local audit contained 367 reports, but only 11 had reviewed bilingual analysis. Chinese text was attached only to that selected subset. The Daily briefing list also mixed reviewed entries with raw chronological reports, while its detail page described an unqueued raw entry as “Analysis is pending.” There was no durable event importance or reading-state system.

## Findings and corrections

| Finding | Correction | Verification |
| --- | --- | --- |
| Daily briefing and News stream had overlapping reading purposes. | Daily briefing now lists assessed, researched events by importance. News stream retains the full collection ordered by publication time. Navigation captions explain the distinction. | Both rendered surfaces inspected. |
| Selected summary content did not guarantee full article-detail analysis. | A selected item must have matching, complete English/Chinese summary, context, implications, uncertainty, watch indicators, evidence and an attention assessment. Invalid imports fail before saving. | Import validation tests and previously unreviewed Lansing detail inspected. |
| 356 source entries lacked Chinese coverage. | Source-text translation is a separate import stage, required for every new or changed report. Publisher excerpts and headline-only translations retain distinct provenance; translation cannot grant analysis status. | Live API inspected during this audit: 367/367 bilingual, zero translation gaps. Raw stream and all three language modes inspected. |
| Unreviewed entries were labeled “pending” without a saved request. | Unreviewed entries say “Not yet analyzed.” An explicit request creates a durable analysis queue item for the next Codex research run. Completion requires current full bilingual analysis. | A Fed entry was requested through the UI, appeared pending in the API, and completed after its researched overlay was imported. |
| Newer small stories could displace older significant developments. | Stable event assessments carry an editorial importance score, bilingual reason and review horizon. Age reduces rank by at most five points. The daily workflow has no novelty quota. | The actual 28-day-old Fed entry ranked third, above the new Lansing entry. Controlled retention/ranking tests cover expiry and refresh. |
| Important unread news could disappear after a daily boundary. | Scores of 75 or more are held until explicitly read, including beyond the normal 30-day collection window. Due reviews retain dated assessments with visible review flags. | Read/unread and reload persistence inspected in the live UI; beyond-horizon retention tested with controlled fixtures. |
| Multiple reports and minor edits could reset reading state. | Reports share semantic event/development keys. Only a reviewed material development can reopen a read event. Grouped overlays must agree on the same assessed version. | Duplicate, minor-edit, material-update and inconsistent-group tests pass. |
| Historical analysis and a new collection timestamp could be confused. | Factual analysis time, priority review time, publication time and collection time remain separate. Changed source text invalidates current analysis; a retained reviewed snapshot is explicitly historical. | Fingerprint/provenance tests pass; overview and watch-link selectors preserve reviewed details. |
| An old open modal could mark a newer unseen update read. | Read mutations include the expected material-update key. A changed version rejects the mutation and reloads the current state. | Stale-modal regression and live versioned read roundtrip pass. |

## Recorded local snapshot

- Collection timestamp recorded during verification: **2026-10-14T18:22:48.215968Z**, 367 reports, 19 enabled feeds collected successfully. Two feeds were labeled as containing older reporting.
- Source-text coverage: **367 English/Chinese summaries**, including 59 explicitly headline-only entries. Summary provenance distinguishes 292 publisher-excerpt translations and 16 researched summaries.
- Independent research: **16 article analyses, representing 15 grouped events**. The other **351 source entries remained unreviewed** and were labeled accordingly. The overview selected 12 significant developments; the retained event agenda is independent of that daily selection.
- Retention: 15 unread assessed events, of which eight qualified for retention until read at verification. Browser verification restored all temporary read toggles to unread.
- Source-text quality: 42 scope labels and two English summaries were corrected during the independent audit. Historical UN reporting was identified as historical in both languages; feed timestamps alone are not treated as event dates.
- Native Codex automation in that installation: an existing 08:00 Eastern task was updated to translate every new/changed report, prioritize requests and continuing major events, preserve reading state, and verify the local result. That account-specific task and its receipt are not included in the public repository; a clone has no scheduled task.

## Verification boundaries

The frontend bundle for that installation was built and served by its restarted local loopback service; this was local verification, not a hosted public deployment. API health, the general English/Chinese overview, researched details, raw translations, headline-only scope, historical content, source status and reading controls were inspected in the actual browser. Desktop and 390-pixel phone layouts were checked without horizontal page overflow. Thirty-five backend/API tests and five frontend selector tests passed.

The first future unattended scheduled run has **not** occurred as part of this audit. Live multi-day passage, a future real material update and loss of a source feed were verified with controlled tests rather than represented as observed future events. The local dashboard refreshes feed reporting; queued independent analysis is researched in the next Codex run. This historical audit does not claim that all 367 reports had independent analysis or that personalized LinkedIn content is connected.

The operating rules are in [DAILY-WORKFLOW.md](DAILY-WORKFLOW.md), [ANALYSIS-POLICY.md](ANALYSIS-POLICY.md) and [ATTENTION-POLICY.md](ATTENTION-POLICY.md).
