# Open-source foundation research

Research verified on **October 14, 2026** using the projects' official GitHub repositories, current README files and GitHub repository API metadata. GitHub stars indicate community recognition and can change; they are not a measure of editorial accuracy.

## Decision

Use **TrendRadar's real RSS parser at a pinned commit**, with a custom local source registry, collection and storage layer, dashboard and sourced briefing workflow. This is an actual component integration, not a claim that the entire TrendRadar application or its AI pipeline runs behind this dashboard. Preserve its GPL license and upstream attribution.

A local pipeline is a practical fit for a personal US/world brief: publisher RSS and institutional releases can be collected with few credentials, facts retain their source URLs, and Codex can produce a daily editorial brief from the collected evidence. Native feeds should be preferred over brittle page scraping. Feed polling provides periodically refreshed coverage; a daily scheduled briefing is a daily publication cadence, not continuous real-time monitoring.

## Comparison

| Project | Verified GitHub stars | API license label | Strengths for this goal | Tradeoff |
| --- | ---: | --- | --- | --- |
| [World Monitor](https://github.com/koala73/worldmonitor) | 88,442 | AGPL-3.0 | Global news and geopolitical dashboard, finance variants, crisis signals, maps, AI briefs, local Ollama support | Broad application and provider infrastructure; current frontend is vanilla TypeScript rather than React. Feature-specific data providers may need keys. |
| [TrendRadar](https://github.com/sansan0/TrendRadar) | 62,907 | GPL-3.0 | Python RSS/Atom/JSON Feed parser, local SQLite workflow, filtering, scheduled reports, AI and translation support | Defaults emphasize Chinese trending platforms; the source catalog and briefing design must be tailored to US/world/UN/SDG interests. |
| [RSSHub](https://github.com/DIYgod/RSSHub) | 46,523 | AGPL-3.0 | Extensible adapters for websites without native RSS; optional public company-post feeds | Route availability depends on upstream sites. Some routes need browser infrastructure or configuration, and can break when a page changes. |
| [FreshRSS](https://github.com/FreshRSS/FreshRSS) | 16,286 | AGPL-3.0 | Mature self-hosted feed inbox, tags, OPML, APIs, WebSub and extensions | Requires a PHP application stack; best suited to a separate reading inbox rather than a bespoke evidence-led dashboard. |

Exact repository metadata was obtained from the public GitHub API: [World Monitor](https://api.github.com/repos/koala73/worldmonitor), [TrendRadar](https://api.github.com/repos/sansan0/TrendRadar), [RSSHub](https://api.github.com/repos/DIYgod/RSSHub), [FreshRSS](https://api.github.com/repos/FreshRSS/FreshRSS).

## Why this component

TrendRadar exposes a self-contained parser that requires only the standard library and `feedparser`. Reusing this component avoids installing the full TrendRadar dependency stack merely to parse feeds. The entire upstream package currently requires Python >=3.12 and includes LiteLLM, FastMCP, boto3 and other integrations. The full application remains an option for future platform trend monitoring, notifications or its MCP service.

The pinned commit is [`ceabb027fe9bbdafec59dbbfa12cb46c2ba256ce`](https://github.com/sansan0/TrendRadar/commit/ceabb027fe9bbdafec59dbbfa12cb46c2ba256ce), associated with version 6.11.0 and an October 13, 2026 update. The unchanged parser lives at `vendor/trendradar/rss_parser.py`. See its [provenance record](../vendor/trendradar/PROVENANCE.md) for the source path, hashes, dependency and API.

World Monitor is the best full-product alternative if the priority becomes a map-driven intelligence console. Its current architecture uses Vite, vanilla TypeScript, globe.gl/Three.js, deck.gl/MapLibre, Tauri, API contracts and caching/relay surfaces. Its own README documents local startup with no mandatory environment variables, while feature-specific sources can require credentials. That is a substantially broader system than a personal daily reading brief.

## Coverage and analysis limits

- A publisher or institution supplies the original material. Every dashboard item and briefing claim should retain a link to that material and its source identity.
- A feed excerpt is often incomplete. Analysis should record when it used only an excerpt and avoid claiming to have read a complete article.
- Source availability and freshness must be visible. A failed feed fetch must not look like confirmation that nothing happened.
- Institutional releases provide primary statements, but can present the institution's own position. Publisher reports and public discussions should be labeled appropriately and considered separately when corroborating facts.
- Opinion and forum activity can reveal discourse, but do not establish that a factual claim is true or that a view is representative.
- Market reporting and economic analysis should be dated and sourced. This dashboard is for learning and monitoring, with no automatic trades or investment recommendations.
- AI-written analysis should distinguish reported facts, inference, competing explanations and unresolved questions. A generated confidence label is not a calibrated probability.
- The scheduled daily edition is distinct from the latest collection time. The UI should display both so the user can assess whether the brief reflects newly collected events.

## LinkedIn and professional insights

RSSHub includes a public [LinkedIn company-posts route](https://github.com/DIYgod/RSSHub/blob/master/lib/routes/linkedin/posts.ts), `/linkedin/company/:company_id/posts`. The implementation launches a browser and parses public HTML. It is an optional adapter; no stable personalized LinkedIn feed or authenticated-account integration is promised.

Professional insights can initially come from public research institutes, industry publications, organization blogs and user-supplied public links. LinkedIn items should identify themselves as posts or company statements. If a public LinkedIn page is unavailable or requires login, report that limitation instead of bypassing it or fabricating an extracted insight.

## Primary documentation

- [TrendRadar repository](https://github.com/sansan0/TrendRadar)
- [TrendRadar English deployment and feature documentation](https://github.com/sansan0/TrendRadar/blob/master/README-EN.md)
- [TrendRadar pinned RSS parser](https://github.com/sansan0/TrendRadar/blob/ceabb027fe9bbdafec59dbbfa12cb46c2ba256ce/trendradar/crawler/rss/parser.py)
- [TrendRadar dependency manifest](https://github.com/sansan0/TrendRadar/blob/master/pyproject.toml)
- [World Monitor README](https://github.com/koala73/worldmonitor)
- [World Monitor architecture](https://www.worldmonitor.app/docs/architecture)
- [World Monitor sources catalog](https://www.worldmonitor.app/docs/data-sources)
- [RSSHub repository and official documentation](https://github.com/DIYgod/RSSHub)
- [FreshRSS repository and feature documentation](https://github.com/FreshRSS/FreshRSS)
