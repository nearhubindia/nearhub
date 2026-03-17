# AI Moderation Setup (Current)

This server uses Ollama with `llava-phi3` in `server/shared/ai/ai.ts`.

## 1. Install and Run Ollama

```bash
ollama --version
ollama pull llava-phi3
ollama list
```

Ensure Ollama API is reachable at:

- `http://localhost:11434`

## 2. Server Environment

Set in `server/.env`:

```bash
OLLAMA_URL=http://localhost:11434
```

## 3. Run Server

```bash
cd server
npm install
npm run dev
```

## 4. How Moderation Works Right Now

- AI helpers are implemented in `server/shared/ai/ai.ts`.
- Functions include:
  - `analyzeImageContent(...)`
  - `analyzeVideoContent(...)`
  - `validateListingWithVision(...)`
- Listing creation flow currently supports manual moderation/review paths in subscription routes.

## 5. Verify Endpoint Surface

OpenAPI route docs are generated from:

- `server/shared/docs/openapi.ts`
- `server/shared/routes/api-docs.ts`

## 6. Troubleshooting

### Ollama not reachable

```bash
curl http://localhost:11434/api/tags
```

### Model missing

```bash
ollama pull llava-phi3
```

### Slow inference

- First request after startup is slower.
- Keep Ollama process warm while testing moderation-heavy flows.
