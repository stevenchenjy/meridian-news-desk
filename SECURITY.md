# Security and local data

Meridian is a local application. The server binds to loopback and rejects non-local Host headers and cross-origin update requests. It has no account authentication or multi-user authorization; run it on your own computer rather than exposing it directly to the Internet.

News pages and feed entries are untrusted evidence. Workflow instructions require the research author to ignore commands embedded in source material. Imports validate IDs, bilingual fields, source-link presence, snapshot identity and event consistency; they do not prove that a publisher's claims are true.

Reader state and generated reporting live in the ignored `data/` directory. Local schedule receipts live in ignored `config/schedule.local.json`. Keep feed URLs containing access credentials, exported account content and API keys out of commits. The included application does not need an OpenAI API key; an optional Codex research workflow uses the reader's own Codex environment.

For a vulnerability, use the repository's private vulnerability reporting option when available. Avoid including live credentials or private reading data in a public issue. For ordinary bugs, include reproduction steps using the fictional demo, the relevant versions and sanitized diagnostics.
