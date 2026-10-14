# Event importance, retention and reading policy

The daily briefing answers “What still deserves my attention?” The news stream answers “What reporting has arrived?” Importance is evaluated at the event level, so multiple outlets covering the same development do not fill the dashboard with duplicates. English and Chinese rationale must explain each reviewed decision.

## Score meaning

`importance` is a 0–100 ordinal editorial score for this reader's US/global interests. It is not a probability, investment signal, measure of popularity or perfectly calibrated scientific index. Compare the scale and severity of consequences, the reach of affected people or systems, the duration of effects, policy or institutional significance, and relevance to the reader's coverage goals. Evidence quality and uncertainty belong in the rationale: an unconfirmed viral claim cannot earn a high score merely by being dramatic.

| Score band | Expected treatment |
| --- | --- |
| 85–100 | Major continuing crisis or development with extensive human, economic or institutional consequences. Review across the rolling month; hold until read. |
| 75–84 | Significant policy, institutional or economic event with effects beyond one news cycle. Hold until read. |
| 60–74 | Useful developing context or field insight; keep for its justified review horizon. |
| 0–59 | Narrow, routine or lower-priority reporting; usually belongs primarily in the stream. |

A provisional heuristic can help discover candidates. Only an evidence-reviewed attention assessment should define the importance and retention policy shown for the briefing. Describe the rationale rather than presenting a number alone. A new short local update must not outrank a still-unread major crisis solely because of its publication time.

## Horizon and unread protection

Choose `horizonDays` between 1 and 30 according to how long the event remains useful to monitor, not how long the headline has been online. Examples: routine corporate earnings may need seven days; a live eligibility deadline may need review through the approaching election; a humanitarian access crisis or continuing court dispute may need thirty days. The horizon is a re-review date, not a promise that the issue resolves then.

Set `keepUntilRead` for every reviewed event scoring 75 or above. These important unread events remain in the attention list beyond the normal horizon and refresh boundary until the reader explicitly marks the event read. They retain the last reviewed bilingual assessment even if the publisher drops the article from its feed. Age alone must not delete that unread assessment.

Marking read removes the event from the default unread briefing. The event assessment remains available through the read filter, with the ability to mark unread. Its source article remains in the news stream while retained by the collection or bookmarking. Bookmarking and reading are separate decisions. Opening a detail or external report does not automatically mark read; the reader must use the explicit control.

Review due or unresolved major events on each daily run. The event’s priority `reviewedAt` and review horizon are separate from the factual analysis `analyzedAt`; a new priority assessment is not a new factual verification date. Reaffirming the same evidence must preserve its original material-update identity and the reader's read state. Retained older analysis must show its date and any review need. Never relabel it “new” simply because a fresh collection or Codex run occurred.

## Event identity and material updates

Use a stable semantic `eventKey`, such as `hormuz-commercial-shipping-attacks`, across reporting of the same underlying event. Group genuine duplicates and use one lead reviewed article; supporting reports retain their provenance. Avoid merging unrelated events because they share a country, person or liveblog.

Use a semantic `updateKey`, such as `gfs-pride-sinking-and-safe-crew-evacuation`, to identify the substantive development actually assessed. It must not be a collection timestamp, daily date, content fingerprint or random identifier. Keep it unchanged for a duplicate report, spelling fix, slightly edited excerpt, new syndicated page, liveblog activity counter or cosmetic headline change.

Change the material-update key only when reviewed evidence changes what the reader needs to know: a consequential decision, reversal, confirmed new impact, intervention or resolution. The backend then makes a previously read event unread again for that update. The reviewer must identify the new facts and their supporting evidence. A source fingerprint change requests re-review; it does not itself justify resetting the read state.

## Queue, coverage and limits

The analysis queue gives the reader a way to ask for context on a stream story. Process requested items and high-priority unreviewed candidates before filling remaining time with lower-priority commentary. Queue completion requires current full bilingual analysis; translation or an old retained event snapshot alone does not complete it.

No daily quota forces replacement of existing events. The briefing can contain unchanged important unread items, newly verified developments, and material updates to older events. The general English/Chinese overview must explain the continuing agenda and real changes. If no material change occurs, do not manufacture new analysis to produce a notification.

Editorial scores are revisable. A score increase, especially promotion into the held-until-read tier, requires fresh checked evidence and a revised bilingual rationale; popularity or a newer publication timestamp alone is insufficient. Preserve reasons, analysis timestamps, supporting evidence and semantic update identities so the reader can understand and challenge a ranking. Before reporting success, verify older unread persistence, explicit read/unread controls, true material-update reopening, duplicate grouping and Chinese rendering on the actual dashboard.
