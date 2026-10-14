# TrendRadar component provenance

This project uses the actual TrendRadar RSS parser for RSS, Atom and JSON Feed ingestion. The parser is vendored unchanged; the dashboard, source registry, storage, collection orchestration and evidence-led briefing workflow are separate application code.

| Field | Value |
| --- | --- |
| Upstream project | [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) |
| Upstream version at pin | 6.11.0 |
| Upstream commit | [`ceabb027fe9bbdafec59dbbfa12cb46c2ba256ce`](https://github.com/sansan0/TrendRadar/commit/ceabb027fe9bbdafec59dbbfa12cb46c2ba256ce) |
| Commit date | October 13, 2026 |
| Retrieved | October 14, 2026 |
| Original parser path | [`trendradar/crawler/rss/parser.py`](https://github.com/sansan0/TrendRadar/blob/ceabb027fe9bbdafec59dbbfa12cb46c2ba256ce/trendradar/crawler/rss/parser.py) |
| Local parser path | `vendor/trendradar/rss_parser.py` |
| Local changes | None; renamed file only |
| Parser SHA-256 | `ad6cc769594c039653bc9eacf7d593e39c007c46f47633bd7cd5a9965d97baca` |
| License | Upstream GPL-3.0; exact upstream license text in `vendor/trendradar/LICENSE` and root `LICENSE` |
| License SHA-256 | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` |

The package marker `__init__.py` is application packaging metadata. It is not an upstream file.

## Dependency and API

The vendored parser needs `feedparser`. The version pinned by the upstream release is `feedparser==6.0.12`; install it through this application's Python requirements, or directly with `python -m pip install feedparser==6.0.12` in the application's virtual environment.

```python
from vendor.trendradar.rss_parser import RSSParser

items = RSSParser(max_summary_length=1200).parse(feed_content, feed_url)
```

Each returned `ParsedRSSItem` provides `title`, `url`, `published_at`, `summary`, `author` and `guid`. The parser removes HTML tags and collapses whitespace. Summaries may be shortened to the configured character limit.

The upstream parser converts `feedparser` date structures into naive ISO timestamps. These represent UTC. Application code should attach UTC to those naive dates before freshness checks or display-time conversion. Explicit offsets from other parsing paths should be preserved. Do not interpret a naive result as America/New_York time.

## Maintenance

To update this component, inspect upstream changes, select an explicit commit, replace both the parser and upstream license, then update this document and validate RSS, Atom, JSON Feed and date normalization in the collector. Do not silently fetch a floating branch during normal application startup.

This component supplies parsing. It does not independently establish source reliability, corroborate events, generate an AI briefing, extract authenticated LinkedIn content or guarantee feed availability.

## Initial verification

On October 14, 2026, the downloaded parser and license hashes were compared with the pinned artifacts above, and the root license was checked against the preserved upstream license. A temporary Python environment with `feedparser==6.0.12` successfully parsed RSS, Atom and JSON Feed fixtures, preserved source links and GUIDs, removed summary HTML, decoded title entities and raised an error for an invalid feed. Date fixtures confirmed the naive UTC behavior described above. These checks verify the component; live publisher availability, dashboard rendering and daily task execution are separate application checks.
