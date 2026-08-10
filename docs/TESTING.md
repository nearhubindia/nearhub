# NearHub testing layout

NearHub follows a feature-owned testing pattern:

```
server/features/<feature>/tests/*.test.ts   # backend unit tests
web/src/features/<feature>/tests/*.test.ts  # web unit tests
web/e2e/*.spec.ts                            # Playwright browser tests
```

## Commands

From the repository root:

```bash
npm run test:unit
npm run test:coverage
npm run test:all       # coverage gates + Playwright
npm run test:unit:server
npm run test:unit:web
npm run e2e
```

The backend’s existing Jest tests remain available for database-backed API
coverage with `npm run test:api --prefix server`. Feature units use Vitest so
they stay fast and do not require PostgreSQL, Redis, or external providers.

`test:coverage` enforces 85% statements/lines/functions and 80% branches for
deterministic feature logic. Database-backed Jest tests remain a separate
integration suite and need a PostgreSQL-backed test environment.

Playwright starts a production Vite preview automatically. API calls are
fixture-backed in the browser specs, so the web suite is deterministic and
does not require a running backend.
