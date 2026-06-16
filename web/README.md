# NearHub Web

Vite + React admin and customer-facing web app for NearHub.

## Main commands

```bash
npm run dev
npm run build
npm run lint
npm run type-check
npm run format
```

## Deploy

- Production: `npm run deploy:cloudflare:prod`
- Preview: `npm run deploy:cloudflare:preview`
- Auto mode: `npm run deploy:cloudflare:auto`

## Project layout

- `src/features/landing/` - home page and customer-facing flows
- `src/features/admin/` - admin pages, components, hooks, and API helpers
- `src/shared/` - reusable app-wide components and hooks
- `src/components/` - generic UI and table primitives
- `scripts/` - build and deploy helpers
- `public/` - static assets served by Vite

## Notes

- Keep generated build output out of source control.
- Prefer shared hooks/components for repeated UI behavior.
- Use `src/shared/components/index.ts` and `src/shared/hooks/index.ts` for common exports when they help reduce import clutter.
