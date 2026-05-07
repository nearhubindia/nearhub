# CI/CD Setup (GitHub Actions)

This repo now includes:

- `CI` workflow: type-check for `app`, `server`, `web`
- `Deploy Server (AWS EC2, Artifact Only)` workflow
- `Deploy Web (Cloudflare Pages)` workflow

## 1. Required GitHub Secrets

Set these in `GitHub -> Settings -> Secrets and variables -> Actions`.

### Server deploy (AWS EC2)

- `AWS_EC2_HOST` (current production: `56.228.28.36`)
- `AWS_EC2_USER` (current production: `admin`)
- `AWS_EC2_PORT` (default: `22`)
- `AWS_EC2_SSH_KEY` (private key content for `nearhub-prod.pem`)
- `AWS_APP_DIR` (current production: `/opt/nearhub-server`)
- `AWS_ENV_FILE` (current production: `/etc/nearhub/server.env`)
- `AWS_SERVICE_NAME` (optional; leave empty when using PM2)
- `AWS_PM2_APP_NAME` (default: `nearhub-server`)

### Web deploy (Cloudflare Pages)

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT` (example: `nearhub`)

## 2. One-Time EC2 Preparation

On EC2:

1. Create app directory and permissions:

```bash
sudo mkdir -p /opt/nearhub-server/releases
sudo chown -R $USER:$USER /opt/nearhub-server
```

2. Create system env file used by artifact releases:

```bash
sudo mkdir -p /etc/nearhub
sudo cp /path/to/your/server/.env /etc/nearhub/server.env
sudo chown root:admin /etc/nearhub/server.env
sudo chmod 640 /etc/nearhub/server.env
```

3. Ensure Node.js is installed (same major as CI, currently Node 20).
4. Ensure `redis-server` and `nginx` are installed and enabled.
5. Ensure your PM2 process uses `/opt/nearhub-server/current/dist/index.js`.
6. Ensure PM2 survives reboot:

```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u admin --hp /home/admin
pm2 save
```

7. Ensure DB credentials in `/etc/nearhub/server.env` have permission to run migrations.
8. Ensure `/etc/nearhub/rds-global-bundle.pem` exists for the RDS TLS connection and is readable by the deploy user.

## 3. How Deploy Works

### Server (artifact only, AWS EC2)

- Trigger: push to `main` with `server/**` changes, or manual dispatch.
- CI builds server artifact (`dist + package.json + migrations`).
- Artifact is copied to EC2 via SCP.
- EC2 deploy step:
  - extracts into new timestamped release
  - validates `DEPLOYMENT_MANIFEST`
  - refuses deploy if `.git` metadata is present in release
  - links `release/.env` from `/etc/nearhub/server.env`
  - runs `npm ci`, then `npm run db:migrate` (Drizzle), then `npm prune --omit=dev`
  - switches `current` symlink
  - restarts systemd service if configured, or falls back to PM2 (`AWS_PM2_APP_NAME`)

No `git pull` is done on EC2.

### Manual EC2 deploy

- Local PEM path: `nearhub-prod.pem`
- Local helper script: `scripts/deploy-server-ec2.sh`

Example:

```bash
./scripts/deploy-server-ec2.sh
```

### Web

- Trigger: push to `main` with `web/**` changes, or manual dispatch.
- Workflow builds `web/dist`.
- Deploys to Cloudflare Pages with Wrangler.

## 4. Workflow Files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-server-ec2.yml`
- `.github/workflows/deploy-web-cloudflare.yml`

## 5. Pre-Release Test Gate (Server)

Before production release, run:

```bash
cd server
npm run quality:release
```

This gate enforces:
- type-check (`tsc`)
- lint (`eslint`)
- strict Jest run with open-handle detection (`jest --detectOpenHandles --runInBand`)
