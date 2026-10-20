# Editorial rulebook

Every authored Meridian report should help the reader understand what happened, why it matters and what to make of it. Accurate facts are the starting point. A useful report also explains the mechanism, evaluates the evidence and leaves the reader with a concrete takeaway.

This is the standing writing standard for every new or revised reviewed article, briefing item, general overview, reading-desk note, background guide and their English and Simplified Chinese versions. Apply it during manual research, scheduled runs and later editing. Existing saved content needs an editorial review before it can be described as meeting this standard. A documentation change alone does not rewrite that content.

## Give the reader a daily edition

Meridian serves a reader who wants to understand US and world news without already knowing every institution or dispute. English is the primary reading language. Keep existing Chinese reporting available through the language controls; a parallel Chinese version of every new editorial headline and short narrative is optional. Explain an unfamiliar acronym with its full English name and, when useful, a short Chinese meaning on first use. An expansion alone is insufficient when the reader also needs to know what the organization does.

Every newly reviewed event needs an `analysis.headline` and `analysis.readerBrief`. Both require English; Chinese is optional. The headline should identify a concrete change, consequence or question, usually in 6–14 words. Keep the original publisher headline in the source record. Avoid abstract bundles of topics, clickbait and questions the article cannot answer.

The reader brief is a self-contained narrative, usually 80–140 English words in two short paragraphs. Lead with the dated consequential change and introduce unfamiliar actors in the same flow. Then explain the mechanism, affected people or businesses, and the most useful supported editorial assessment. Give numbers a meaningful baseline. Keep a qualification beside a claim when removing it would mislead. Leave extended methodological limits and additional arguments in the full analysis. Vary the approach with the story; do not impose identical sentences or mechanically end every report with a demand to watch implementation.

The short narrative synthesizes the existing reporting and analysis. It must not introduce unsupported facts, flatten a substantive dispute or make a dated assessment sound current. An editorial rewrite preserves the factual review date, evidence and material event identity. Use `scripts/apply_editorial.py` for such edits; use the research importer when facts actually change.

Compose the daily edition around the few developments that most reward explanation. Its title should give the reader a concrete reason to read. The overview should provide a short editorial introduction with clear transitions, without pretending unrelated events share a cause. Separate today's meaningful changes from the continuing agenda. Older important events remain accessible; no fresh-story quota applies. Consider work, healthcare, housing, consumer costs and everyday technology when the evidence supports a worthwhile story. A light item is useful only when it offers understanding, not as compulsory relief from serious news.

## Make the first reading useful

Start with the reader's question and give the consequential development or takeaway first. Briefly introduce unfamiliar actors before developing the detail.

Use familiar words, clear actors and concrete verbs. Keep one idea in a sentence and one topic in a paragraph. Vary sentence length without tangling the meaning. Explain unfamiliar terms. Give numbers a baseline, time period and unit when these affect their meaning.

Use descriptive headings and source labels. Keep qualifications beside the claims they affect. Cut repetition and filler. Read as a non-specialist and rewrite sentences that need a second reading.

These principles adapt the [plain-english-content skill](https://raw.githubusercontent.com/openhands/extensions/main/skills/plain-english-content/SKILL.md). Keep Meridian's US dates and natural Chinese conventions.

## Apply Humanizer to every authored report

Use the installed `humanizer:humanizer` skill in embedded mode after drafting. If that skill is unavailable, apply the practical editing rules below; the repository does not require a machine-specific skill path.

Run draft, audit and final revision internally. Publish only the final prose. Ask whether the draft sounds formulaic and whether the rewrite has added any unsupported fact, number, date, name, quote or citation. Correct both kinds of defect before import.

Remove inflated significance, vague authority, noun piles, repetitive sentence patterns and endings that merely say a story has broad implications. Replace phrases such as "a pivotal moment" or "experts believe" with the specific consequence or a named, checked source. Cut promotional language, manufactured punchlines and commentary about the act of explaining. Use ordinary punctuation instead of em or en dashes in authored prose. Preserve punctuation and wording inside faithful quotations, titles and source material.

Humanizing must preserve claims, evidence, uncertainty and the author's defensible judgment. It must never invent detail to make a paragraph vivid. Sounding conversational does not excuse a factual error. Keep the voice direct and curious, with enough variation to sound like someone explaining the subject to an interested reader.

## Explain the consequence and take a defensible position

Every reviewed report needs a concrete editorial takeaway. Tell the reader what the evidence changes about their understanding: who faces a different cost, constraint, opportunity or risk, through what mechanism, and over what relevant period. A report may conclude that the headline overstates the change, that one explanation fits the evidence better, or that the facts support only a narrow conclusion. Explain why.

Avoid endings such as "this could have significant implications" or "the situation remains complex." Complete the causal chain instead: a decision changes a rule or resource; that changes an actor's options; those options affect a specific group or outcome. When a link is uncertain, mark that link and explain what evidence is missing. Distinguish a proposed measure, a binding decision, implementation and observed results.

Use judgment without pretending certainty. Do not manufacture controversy, insist on a middle position, or give equally supported treatment to unequally supported claims. Assess evidence quality, incentives and practical constraints. State when a claim conflicts with stronger evidence. Describe an interpretation as an editorial assessment rather than passing it off as an independently established fact.

Give the judgment a way to fail. In `watch`, identify an observable result that would strengthen or weaken the assessment and explain its significance. A documented vote, release, court order, implementation measure or measured outcome can qualify. "Watch developments" cannot. Use a date only when it is documented; otherwise describe the condition to observe.

### A fictional calibration example

The following invented example demonstrates the writing standard. Its people, organizations and facts are fictional and must never appear as real reporting or checked evidence.

Suppose Harbor's council adopts a shorter permit deadline. Its published plan leaves inspection staffing unchanged. The Harbor Builders Association says faster approvals will reduce financing costs. The Harbor Tenants Union argues that inspections remain the bottleneck.

A weak takeaway is: "The reform could have significant implications, while stakeholders have different views."

A useful assessment is: "The deadline gives applicants a clearer timetable, but it does not by itself establish that homes will be completed sooner. The builders' financing argument depends on actual delays falling. The tenants' strongest challenge is the unchanged inspection capacity. Our assessment: the first test is whether the whole permit-to-inspection process gets faster, rather than whether the city meets its new approval target. Watch end-to-end waiting times and inspection backlogs."

The matching Chinese could read: "新期限让申请人更清楚何时应获答复，但还不能证明住房会更快建成。建筑商所说的融资成本下降，要以实际等待时间缩短为前提。租户组织最有力的质疑是，检查人员并未增加。我们的判断是，应先看从申请到检查的全程是否提速，再评价改革成效。后续观察全程等待时间和积压的检查数量。"

The useful version connects the decision to a mechanism, tests competing arguments and gives the reader a judgment that later evidence can challenge. A real report must first verify every factual premise and attributed view.

## Bring in voices that add understanding

Research relevant perspectives while checking the event. Useful voices include a named commentator, researcher, practitioner, affected group or decision-maker. Include a perspective when it explains a real disagreement, incentive, mechanism or consequence. A routine factual update does not need an artificial dispute or a fixed number of opposing parties.

Identify who holds the view, their relevant role, what they argue and the checked source carrying that argument. For changing positions, give the relevant date. Then explain how the view helps interpret the evidence, including a material limitation or conflict of interest where known. A named source's opinion is still an opinion. Official statements establish the official's stated position; they do not independently verify the outcome claimed.

Compare substantive arguments when credible views differ. Explain the evidence or assumptions on which they diverge and which interpretation is better supported. A forum participant's argument can illustrate a perspective but cannot stand for public opinion. Several publications repeating the same source do not create several independent views.

Prefer an accurate attributed paraphrase to a decorative quote. Quote only words actually checked in the linked source. Never invent a commentator, turn a headline into an expert's opinion, infer a party's view from its identity, or write "analysts say" without identifying the source. If no useful external perspective can be verified, give a bounded editorial assessment from the checked facts and state any material evidence limit. Do not pad the report with an invented consensus.

## Use the existing content fields

The importers reject unknown fields. Use the supported `analysis.headline` and `analysis.readerBrief` for the English-first reading layer, and the existing fields below for the full analysis; do not invent `perspectives`, `takeaway` or `verdict` properties.

Start `analysis.implications` with a concise paragraph containing the clearest supported editorial judgment: this opening powers the visible insight preview, while later paragraphs develop the reasoning, sourced perspectives and qualifications in the full analysis.

| Existing surface or field | Editorial job |
| --- | --- |
| Article `analysis.headline` | A concrete editorial headline, separate from the preserved publisher title. English required; Chinese optional. |
| Article `analysis.readerBrief` | A short, coherent narrative combining the dated development, necessary orientation, mechanism and bounded editorial assessment. English required; Chinese optional. |
| Article and briefing `summary` | Lead with the consequential development, who did what, the date and any qualification needed to understand it. Keep this factual or explicitly attributed. |
| Article `analysis.context` | Give a newcomer the actors, terms and background needed to follow the current development. Add only history that explains the present question. |
| Article `analysis.implications` | Present useful named perspectives and the editorial assessment, showing the mechanism and a concrete takeaway. Keep attribution clear in the prose. |
| Briefing `whyItMatters` | State the short takeaway and the evidence-based reason it matters. It should remain consistent with the fuller article analysis. |
| Article or briefing `uncertainty` | Identify the specific weak link, missing fact or credible alternative that affects the assessment. |
| Article or briefing `watch` | Give observable evidence that would test the assessment, with its practical meaning. |
| `evidence` | Include the exact collected article URL and the pages actually checked, including the sources for attributed views. Use labels that help readers identify them. |
| `briefing.overview` | Explain the leading developments and what connects them, with a useful overall reading of the evidence. Do not repeat a list of headlines. |
| `sectionNotes` | Use a specific title and concise takeaway, explain the necessary orientation in `background`, then state the development and significance in `summary`. Stay within the supported stories and existing bounds. |
| Background guides | Put durable understanding in `takeaways`, attributed positions in `actors`, explanatory history in `roots` and `timeline`, and questions that test new headlines in `readingLens`. Keep changing claims dated and tied to checked `sources`. |

Keep summaries and analysis distinct even when a takeaway appears near the top. Raw publisher excerpts, headline-only translations and direct quotations are exceptions to editorial rewriting: preserve their scope, claims and attribution. Improve a translation's naturalness without inserting the desk's judgment. Add independently researched interpretation only through a reviewed analysis overlay with its own evidence.

## Write naturally in both languages

When both languages are supplied, they must express the same facts, attributed positions, editorial judgment and uncertainty. The stored full-analysis fields and briefing notes retain their existing bilingual validation; optional editorial Chinese must not be filled by copying English. English is the default visible edition, and the language controls provide translations where available. Draft Chinese as an explanation for a Chinese reader, rather than reproducing English syntax. Break up long clauses, explain unfamiliar names in context and avoid strings such as "对相关领域产生深远影响" when the actual effect can be stated.

Do not make the Chinese version more certain, more partisan or less informative than the English. Check names, numbers, dates, actors and allegations across the pair after the Humanizer pass. Natural phrasing can differ; the substance cannot.

Use length to serve the reader. A summary usually needs two or three focused sentences. Context and implications often work best as one or two short paragraphs each; expand when a mechanism or dispute needs explanation. Keep extra historical detail in a relevant guide. These are editing guides, not quotas or extra schema limits. The hard desk-note bounds and the guide's required three takeaways remain as documented in [Daily workflow](DAILY-WORKFLOW.md) and [Background guides](BACKGROUND-GUIDES.md).

## Finish with an editorial check

Before importing each new or revised report, confirm:

- The opening gives the consequential development or takeaway, and a newcomer can understand the actors before the detail.
- The editorial headline is specific, and the short narrative can be read independently of the source list and full analysis.
- The analysis explains a mechanism and gives a useful judgment rather than repeating the summary.
- Every factual claim and attributed perspective has checked support; opinion, inference and fact remain distinguishable.
- The takeaway is proportionate to the evidence, credible alternatives receive appropriate weight, and the watch indicator can test it.
- Humanizer and plain-language editing have removed filler without dropping necessary qualifications; both languages carry the same meaning.

An importer checks data shape and references. It does not certify readability, source support or insight. After import, inspect the saved content, current API and actual English-first edition, including the relevant desk, detail view and background path. Exercise Chinese and bilingual fallbacks without claiming an absent editorial translation exists. Check that the opening is visible, paragraphs are readable and sources are usable. Keep this editorial review distinct from a structural validation, a frontend build, production publication or a future scheduled run.
