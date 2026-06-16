# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Cloudflare Deploy (Important)

Use explicit scripts so changes always reach the expected environment:

- Production (`nearhub.in`): `npm run deploy:cloudflare:prod`
- Preview (non-production): `npm run deploy:cloudflare:preview`
- Auto mode (uses current git branch): `npm run deploy:cloudflare:auto`

Notes:

- `nearhub.in` updates only when deploying with `--branch=main`.
- Deploying without explicit branch may publish to preview (`master`) and not reflect on production.
- The Cloudflare deploy script auto-loads `web/.env.deploy` first and now fails fast if `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or `CLOUDFLARE_PAGES_PROJECT` are missing.
- Copy [`web/.env.deploy.example`](/home/pavanprasad/Downloads/nearhub/web/.env.deploy.example) to [`web/.env.deploy`](/home/pavanprasad/Downloads/nearhub/web/.env.deploy) for Nearhub-specific Cloudflare Pages values.
- Set `VITE_API_URL=https://api.nearhub.in` in `web/.env.deploy` for production so the browser never targets `localhost:5000`.
- For web push, set a real Firebase `VITE_FIREBASE_WEB_PUSH_VAPID_KEY`; the app now skips token registration if the key is missing or invalid.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
