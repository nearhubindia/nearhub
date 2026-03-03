# NearHub

Independent multi-project repository with three runnable applications:

- `app/` - Expo React Native mobile app
- `web/` - Vite React web/admin app
- `server/` - Express TypeScript API server

Each project is intentionally executable on its own with its own dependencies and scripts.

## Run Projects Independently

### Mobile App

```bash
cd app
npm install
npm run dev
```

### Web App

```bash
cd web
npm install
npm run dev
```

### Server

```bash
cd server
npm install
npm run dev
```

## Feature-Based Organization Rules

- Place domain logic inside each project `features/` directory.
- Keep cross-feature/common code inside that project's `shared/` directory.
- Keep global utilities/config in that project's `lib/` directory.
- Avoid duplicate shared modules in multiple folder trees.
- Import from feature public APIs (`index.ts`) instead of deep internal paths where possible.

## Quality Checks (Per Project)

- `npm run type-check`
- `npm run lint`
- `npm run format:check`

Git hooks at repo root now run checks per changed project (`app`, `web`, `server`) instead of assuming a single root package.
