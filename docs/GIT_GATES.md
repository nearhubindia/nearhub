# Git Push Gates

NearHub enforces two repository-level gates before code is pushed and in CI:

- `Architecture Gate`: validates structural rules and route/layer boundaries.
- `Framework Gate`: validates core framework contracts for `app/`, `server/`, and `web/`.

## Where They Run

- Local: `.husky/pre-push`
- CI: `.github/workflows/ci.yml` (`Architecture & Framework Gates` job)

## Manual Run

From repo root:

```bash
node scripts/gates/architecture-gate.mjs
node scripts/gates/framework-gate.mjs
```

## What Is Enforced

### Architecture Gate

- No nested git repos inside the monorepo (`.git` directories under subfolders).
- No Express route registration inside `server/features/**/services/*`.
- `server/routes.ts` must import `register*Routes` from `routes/`, not `services/`.
- Legacy Expo Router entry files under `app/` root are blocked (use `app/src/app/*` only).
- Expo route wrapper re-exports in `app/src/app/*` must resolve to real feature files.
- Duplicate server method+path mappings are blocked.

### Framework Gate

- `app/package.json` must use `main: "expo-router/entry"`.
- `app/app.json` must include `expo-router` plugin.
- `app/src/app/_layout.tsx` must exist.
- `web` must include React + React Router + Vite wiring and required core files.
- `server` must include Express dependency and route bootstrap wiring.
- All three projects must define: `type-check`, `lint`, and `format:check` scripts.
- The backend must expose a feature-scoped `test:unit` script.
- The backend and web app must expose thresholded `test:coverage` scripts.
- The web app must expose `test` and `e2e` scripts for unit and Playwright coverage.

## Updating Gate Rules

Edit:

- `scripts/gates/architecture-gate.mjs`
- `scripts/gates/framework-gate.mjs`

Then run both scripts locally before pushing.
