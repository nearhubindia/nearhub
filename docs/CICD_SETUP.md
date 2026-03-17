# CI/CD Setup (GitHub Actions)

This repo now includes:

- `CI` workflow: type-check for `app`, `server`, `web`
- `Deploy Server (Hostinger VPS, Artifact Only)` workflow
- `Deploy Web (Cloudflare Pages)` workflow

## 1. Required GitHub Secrets

Set these in `GitHub -> Settings -> Secrets and variables -> Actions`.

### Server deploy (Hostinger VPS)

- `HOSTINGER_VPS_HOST` (example: `187.x.x.x`)
- `HOSTINGER_VPS_USER` (example: `root` or deploy user)
- `HOSTINGER_VPS_PORT` (example: `22`)
- `HOSTINGER_VPS_SSH_KEY` (private key content)
- `HOSTINGER_APP_DIR` (example: `/opt/nearhub-server`)
- `HOSTINGER_SERVICE_NAME` (example: `nearhub-server`)

### Web deploy (Cloudflare Pages)

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT` (example: `nearhub`)

## 2. One-Time VPS Preparation

On VPS:

1. Create app directory and permissions:

```bash
sudo mkdir -p /opt/nearhub-server/releases
sudo chown -R $USER:$USER /opt/nearhub-server
```

2. Ensure Node.js is installed (same major as CI, currently Node 20).
3. Ensure your service uses `/opt/nearhub-server/current/dist/index.js`.
4. Ensure service restart works with:

```bash
sudo systemctl restart nearhub-server
```

5. If using DB migrations on deploy, configure env/db access for runtime user.

## 3. How Deploy Works

### Server (artifact only)

- Trigger: push to `main` with `server/**` changes, or manual dispatch.
- CI builds server artifact (`dist + package.json + migrations`).
- Artifact is copied to VPS via SCP.
- VPS deploy step:
  - extracts into new timestamped release
  - validates `DEPLOYMENT_MANIFEST`
  - refuses deploy if `.git` metadata is present in release
  - runs `npm ci --omit=dev`
  - switches `current` symlink
  - restarts systemd service

No `git pull` is done on VPS.

### Web

- Trigger: push to `main` with `web/**` changes, or manual dispatch.
- Workflow builds `web/dist`.
- Deploys to Cloudflare Pages with Wrangler.

## 4. Workflow Files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-server-hostinger.yml`
- `.github/workflows/deploy-web-cloudflare.yml`
