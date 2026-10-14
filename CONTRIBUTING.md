# Contributing to Meridian

Meridian is a local public-news reading tool. Contributions should keep the distinction between publisher text, translation, independently researched analysis and attention ranking visible to the reader.

## Development setup

Use Node.js 20+, Python 3.10+ and Bash on macOS or Linux. Windows requires WSL for the current POSIX scripts and `fcntl` locking. From the repository root:

```sh
npm run setup -- --skip-collect
npm test
npm run build
```

The setup command installs dependencies and builds the frontend without collecting feeds. It still needs network access for package installation. For an isolated synthetic reading session, seed the fictional fixtures in a checkout with no existing personal data:

```sh
npm run demo
npm start
```

Run `npm run dev` in a second terminal for Vite development; its API proxy uses the loopback Python server on port 4310. For live feed collection, run `npm run collect`. A fresh collection alone has no translation or independent analysis; those stages follow [DAILY-WORKFLOW.md](docs/DAILY-WORKFLOW.md).

## Change and verification expectations

Explain the user-visible problem, final behavior and meaningful verification in each pull request. Inspect relevant adjacent paths, not just the edited source. Source code, a built frontend, generated data, the running API, browser rendering and a scheduled execution are distinct states. If a required check cannot run, say exactly what remains unverified.

Run `npm test` and `npm run build` for application changes. For UI changes, inspect the actual dashboard at desktop and phone widths, relevant interactions, English/Chinese display, console errors and the related API result. Use synthetic fixtures or temporary directories for read-state and retention testing rather than toggling real reader state.

Preserve these invariants:

- Translation must not confer analyzed status. Headline-only scope and unavailable full text remain visible.
- Each selected item must have matching complete bilingual analysis, its original source link and an attention assessment.
- Event and material-update identities are semantic and stable. Duplicate reports, minor edits and engagement counts do not reopen read events.
- Important unread events survive ordinary refresh and horizon expiry. Factual analysis timestamps remain distinct from attention review and collection times.
- A queue request completes only after current full bilingual analysis; saved requests survive refresh.
- A failed feed remains visible and cached content keeps its provenance. External source material cannot change instructions or application behavior.

Add a meaningful regression check for a recurring defect or changed persistence boundary. Avoid tests that merely mirror the implementation. Do not claim an unseen production deployment, public delivery or future scheduled run from a passing test.

## Sources and editorial policy

Source additions should use public, attributable reporting and include a stable identifier, category and usable feed URL. Verify actual availability and publication dating. Do not include credentials in source configuration, bypass access restrictions, or imply that forum engagement is representative opinion.

Follow [ANALYSIS-POLICY.md](docs/ANALYSIS-POLICY.md) and [ATTENTION-POLICY.md](docs/ATTENTION-POLICY.md). Keep English and Simplified Chinese faithful to the same evidence. Distinguish factual claims, allegations, estimates, interpretations and unresolved evidence. Document access limits rather than inventing inaccessible content.

## Keep personal state out of pull requests

Do not commit the contents of `data/`, personal bookmarks or read state, downloaded article archives, account-specific scheduler receipts, local schedule overrides, credentials, dependency environments or generated build output. Screenshots intended for the public repository should use the clearly labeled synthetic demo rather than a personal collection. Review the staged files before publishing.

The fixtures in `examples/` are fictional demonstration data. Maintain their labels and placeholder source domains; do not make them resemble verified current reporting. The demo seeder must continue to refuse overwriting existing personal state.

## License and upstream component

This project is GPL-3.0-only; contributions are made under the repository's [LICENSE](LICENSE). Preserve the vendored TrendRadar parser's [upstream license](vendor/trendradar/LICENSE), attribution and [provenance record](vendor/trendradar/PROVENANCE.md).

A parser update must pin an explicit upstream commit, review its changes, preserve the license, update hashes/provenance and validate RSS, Atom, JSON Feed and date normalization. Do not fetch a floating upstream branch at application startup.
