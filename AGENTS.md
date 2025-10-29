# Repository Guidelines

## Project Structure & Module Organization
- `index.js`: CLI entry using `m3u8-dln` (ESM). Sets HTTP/HTTPS proxy and downloads to `data/`.
- `download.js`: Standalone downloader with resume support and progress output; writes segments to `data/` and saves `playlist.m3u8`.
- `data/`: Generated artifacts (segments, playlists). Do not commit.
- `package.json`: Minimal scripts (`start` runs `index.js`). ESM module type.
- `README.md`: Usage, examples, and ffmpeg merge instructions.

## Build, Test, and Development Commands
- Install deps: `npm install`
- Run via library: `npm start -- <M3U8_URL>`
- Run manual tool: `node download.js <M3U8_URL>`
- Merge output: `cd data && ffmpeg -i playlist.m3u8 -c copy output.mp4`
- Clean artifacts: `rm -rf data/*` (use with care).

## Coding Style & Naming Conventions
- Language: JavaScript (Node 18+, ESM). Use `import`/`export` only.
- Indentation: 2 spaces; semicolons required; single quotes.
- Names: `lowerCamelCase` for variables/functions, `kebab-case` filenames.
- Structure: Small, pure functions; avoid side effects outside `main()`.
- Tooling: No linter configured. If adding, prefer Prettier + ESLint (`eslint:recommended`) without changing existing style.

## Testing Guidelines
- No test framework yet. For changes, include a manual repro in the PR and verify:
  - `data/playlist.m3u8` is created.
  - Segment count matches playlist; rerun resumes correctly.
- If adding tests, use `__tests__/` and name files `*.test.js`; include `npm test` script.

## Commit & Pull Request Guidelines
- Commits: Use Conventional Commits (e.g., `feat:`, `fix:`, `docs:`). Imperative mood, short subject, rationale in body.
- PRs: Describe motivation, steps to reproduce, before/after behavior, and logs/screenshots when relevant. Link issues. Update `README.md` for user-visible changes. Exclude `data/` artifacts.

## Security & Configuration Tips
- Proxy defaults to `http://127.0.0.1:7890`. Prefer env overrides (`GLOBAL_AGENT_HTTP_PROXY`/`GLOBAL_AGENT_HTTPS_PROXY`) when changing behavior; don’t hardcode credentials.
- Avoid committing secrets or tokens embedded in URLs. Scrub sensitive query params from examples.

## Agent-Specific Instructions
- Keep changes minimal and focused. Do not rename scripts or alter CLI flags without updating `README.md` and `package.json`.
- Preserve ESM setup. Avoid heavy dependencies unless necessary and justified in the PR.
