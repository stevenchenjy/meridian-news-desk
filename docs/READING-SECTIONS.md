# Reading sections

Meridian has four reading desks. Each reviewed event has one home, so reading a second desk adds different events rather than presenting the same story through another topic label. A desk opens the importance-ranked, researched reading agenda; it does not open an entire publisher feed.

| Desk | 中文 | Main question |
| --- | --- | --- |
| Politics & world | 政治与国际 | Who exercises public power, and what changes in government, law, diplomacy or security? |
| Economy & business | 经济与商业 | What changes in economic conditions, finance, trade or business activity? |
| People & planet | 社会与可持续发展 | What changes for people's welfare, humanitarian needs, development or the environment? |
| Industry & technology | 行业与科技 | What changes in technology, research, professional practice or how an industry works? |

US and international politics share one desk. Crisis, UN and SDG reporting are organized by the event's main question rather than appearing in separate overlapping lists. A UN statement about diplomacy belongs with politics; one about food access belongs with people and planet. The publisher's identity does not decide the event's home.

## Assign one event to one desk

Set `attention.readingSection` to `politics`, `economy`, `development` or `industry` when preparing a reviewed attention assessment. All reports grouped under the same stable `eventKey` must use the same desk. The dashboard resolves desk membership at the event level, so another member report cannot place that event in a second desk. Keep supporting articles and evidence within the event's detail rather than making a reader repeat the event in another desk.

Choose the home according to the central development being analyzed:

- A ceasefire negotiation, election rule or military decision belongs in **Politics & world**. An assessment centered on blocked food supplies, displacement or civilian welfare belongs in **People & planet**.
- A central-bank rate decision, inflation release or broad trade disruption belongs in **Economy & business**. An assessment centered on a manufacturing method, digital system or professional workflow belongs in **Industry & technology**.
- A technology regulation can belong in politics, economy or industry. Pick the desk that answers the assessment's main question: the exercise of public authority, an economic consequence, or a change in the technology and its use. Do not copy the same assessed event into all three.

An ongoing situation can produce genuinely distinct events. An agreement and a subsequent, separately verified humanitarian breakdown may justify separate assessments with different central claims and evidence. A second source, a different headline, a market reaction mentioned in passing or a shared company name does not establish a new event. State the material development covered by each `eventKey` and avoid both duplicate assessments and overly broad keyword grouping.

For older assessments without an explicit desk, the application maps the primary source category: `us` and `world` → `politics`; `crisis` and `sdg` → `development`; `economy` → `economy`; `industry` → `industry`. This compatibility fallback gives an older event a single home. It is less precise than an editorial assignment and should be reviewed when that event is next assessed. `relatedCategories` remains descriptive metadata; it does not create extra reading-desk membership.

## Select for significance

Within each desk, rank the continuing researched events using their editorial importance and existing read state. An older important unread event can outrank today's minor story. There is no requirement to fill every desk, add a set number of new items, or show every newly collected report. An empty desk is preferable to a misleading sense that unreviewed reporting has been researched.

The **Daily briefing / All** view deliberately combines the desks into one overall agenda. It is a way to read across the dashboard, so an event seen there will also be found in its one home desk. **Saved stories** is a personal selection. The four desks themselves are mutually exclusive.

The **News stream** keeps the complete retained publisher collection, with separate translation and analysis status. Duplicate URLs are combined during collection. Different URLs reporting the same event can remain separate if they have not been reviewed and grouped under a shared event identifier. The application does not claim to recognize every duplicate or infer all events through fuzzy matching.

## Write matching notes

New `briefing.sectionNotes` inputs use `all`, `politics`, `economy`, `development` and `industry`. A desk note must cite reviewed articles from events assigned to that desk; the `all` notes can synthesize events across desks. Explain the actors and issue in `background`, then the latest development in `summary`, with matching English and Simplified Chinese. Notes should add orientation to the selected events rather than repeat an identical general narrative in every desk.

Older note scopes `us`, `world`, `crisis` and `sdg` remain accepted for input compatibility. They are not additional reading desks. Newly authored notes should use the four desk identifiers. Existing inputs that omit desk assignments remain supported; this does not change the one-home rule in the reading interface.

A desk, search or saved selection only displays notes supported by its matching stories. Missing edited notes can use those stories' existing reviewed context and bilingual summaries. No selection should substitute an unrelated global narrative or invent background from an unreviewed excerpt.

## Verify the reading experience

Use the same read filter for all four desks, then compare stable event IDs: the desk lists must be pairwise disjoint, and their combined events must match the corresponding overall researched agenda. Confirm related categories and additional reports do not duplicate an event across desks. Also inspect the empty-desk state, background-first notes in both languages, a search, saved stories and the full publisher stream.

Changing a desk assignment is an editorial organization change. It must preserve the event's stable identity, read state, importance rationale and original factual review date unless the underlying evidence has actually been rechecked. See [Daily workflow](DAILY-WORKFLOW.md), [Analysis policy](ANALYSIS-POLICY.md) and [Attention policy](ATTENTION-POLICY.md).
