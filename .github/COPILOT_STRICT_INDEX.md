# Copilot Strict Index (No Duplicates)

This file is the **single enforcement index** for where code must live.
Copilot should prefer **edit-in-place** over creating new files/routes.

---

## 1) Hard Rules

1. Do not create a new file if a matching domain file already exists.
2. Do not register a route if the same `METHOD + PATH` exists anywhere in `server/**/*.ts`.
3. Do not fork `shared` modules into parallel copies (`shared/hooks` vs `shared/contexts`, `shared/utils` vs `lib`).
4. For wrappers/barrels, only re-export canonical modules. Do not add business logic there.

---

## 2) Canonical Ownership (Mobile `app/`)

### Context state (canonical)
- `app/shared/contexts/*.tsx` are the source of truth.
- `app/shared/hooks/*-context.tsx` must be re-export wrappers only.

### Utilities (canonical)
- `app/lib/*.ts(x)` are the source of truth for utility logic.
- `app/shared/utils/*.ts(x)` must be re-export wrappers only.

### Route wrappers (allowed)
- `app/*.tsx`, `app/auth/*.tsx`, `app/chat/*.tsx`, `app/listing/*.tsx`, `app/(tabs)/*.tsx`
  are route wrappers that re-export from `app/src/app/*`.
- Do not duplicate feature logic in wrappers.

---

## 3) Canonical Ownership (Server `server/`)

### Route registration source
- All route registration happens in `server/routes.ts`.
- Add/modify endpoints by updating the owning feature route file; then register once in `server/routes.ts`.

### Dynamic pricing ownership
- Category/type pricing endpoints:
  - `GET /api/pricing/dynamic`
  - `POST /api/pricing/dynamic/calculate`
  - `GET /api/pricing/dynamic/batch`
  - `GET /api/pricing/dynamic/preview`
  - Owner: `server/features/payments/routes/dynamic-pricing.ts`
- Location demand pricing endpoint:
  - `GET /api/location/pricing/dynamic`
  - Owner: `server/features/search/services/location.ts`

### Listing creation ownership
- Canonical create endpoint: `POST /api/subscriptions/create-listing`
  - Owner: `server/features/subscriptions/routes/subscriptions.ts`
- `POST /api/listings` must not be reintroduced.

---

## 4) Pre-Create Checklist (Copilot must run mentally / user should run in terminal)

Before creating any file or route:

1. Search existing files:
```bash
rg --files app web server | rg "<feature-or-module-name>"
```

2. Search route key collisions:
```bash
rg -n "app\\.(get|post|patch|put|delete)\\(" server
```

3. For app shared modules, verify canonical location:
- If state/context: use `app/shared/contexts/*`
- If utility logic: use `app/lib/*`
- If `shared/hooks` or `shared/utils`: re-export only

If a match exists, modify that file. Do not create a sibling duplicate.

---

## 5) Duplicate Patterns to Reject

- Same utility in both `app/lib/*` and `app/shared/utils/*` with separate logic.
- Same context implementation in both `app/shared/contexts/*` and `app/shared/hooks/*`.
- Same API route path/method defined in multiple server route files.
- Legacy/alternate endpoints added without deprecation + migration plan.

---

## 6) Preferred Workflow

1. Locate owner using this index.
2. Edit owner file.
3. Keep wrappers/barrels as re-export only.
4. Validate:
   - `cd app && npm run type-check` (if app touched)
   - `cd server && npm test -- --runTestsByPath __tests__/features/listings.test.ts --watch=false` (if server routes touched)

