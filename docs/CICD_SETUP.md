# CI/CD Setup (GitHub Actions)

This repo now includes:

- `CI` workflow: type-check for `app`, `server`, `web`
- `Deploy Server (AWS EC2, Artifact Only)` workflow
- `Deploy Web (Cloudflare Pages)` workflow

## 1. Required GitHub Secrets

Set these in `GitHub -> Settings -> Secrets and variables -> Actions`.

### Server deploy (AWS EC2)

- `AWS_EC2_HOST` (current production: `65.2.151.47`)
- `AWS_EC2_USER` (current production: `admin`)
- `AWS_EC2_PORT` (default: `22`)
- `AWS_EC2_SSH_KEY` (private key content for `nearhub-debian-key-20260524-015812.pem`)
- `AWS_APP_DIR` (current production: `/opt/nearhub-server`)
- `AWS_ENV_FILE` (current production: `/etc/nearhub/server.env`)
- `AWS_COMPOSE_PROJECT_NAME` (default: `nearhub`)
- `AWS_COMPOSE_FILE_NAME` (default: `docker-compose.prod.yml`)
- `AWS_DOCKERFILE_NAME` (default: `Dockerfile.prod`)

### Local server deploy config

- `server/.env.deploy.example` documents the same EC2 deploy defaults used by `scripts/deploy-server-ec2.sh`
- Copy it to `server/.env.deploy` if you want to keep local manual deploy settings in one place

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

3. Ensure Docker and the classic `docker-compose` binary are installed and enabled.
4. Ensure DB credentials in `/etc/nearhub/server.env` have permission to run migrations.
5. Ensure `/etc/nearhub/rds-global-bundle.pem` exists for the RDS TLS connection and is readable by the deploy user.
6. For Razorpay, keep both alias pairs populated in `/etc/nearhub/server.env`:
   - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_API_KEY` and `RAZORPAY_API_SECRET`
     The runtime accepts either pair, but setting both avoids mismatches across scripts and services.

## 3. How Deploy Works

### Server (artifact only, AWS EC2)

- Trigger: push to `main` with `server/**` changes, or manual dispatch.
- CI builds server artifact (`dist + package.json + migrations + Docker Compose files`).
- Artifact is copied to EC2 via SCP.
- EC2 deploy step:
  - extracts into new timestamped release
  - validates `DEPLOYMENT_MANIFEST`
  - refuses deploy if `.git` metadata is present in release
  - links `release/.env` from `/etc/nearhub/server.env`
  - builds the production Docker image from the release artifact
  - starts Redis and the server with `docker compose`
  - runs `npm run db:migrate` inside the server container
  - switches `current` symlink
  - installs and enables `nearhub-stack.service` so the stack comes back after reboot
  - installs and enables `nearhub-disk-cleanup.timer` for daily safe cleanup of old releases, Docker cruft, apt cache, and journal logs
  - validates the `/api/health` endpoint

No `git pull` is done on EC2.

### Manual EC2 deploy

- Local PEM path: `nearhub-debian-key-20260524-015812.pem`
- Local helper script: `scripts/deploy-server-ec2.sh`
- The helper script auto-loads `server/.env.deploy` and `server/.env.deploy.local` before falling back to repo and server env files

If the production EC2 does not use an Elastic IP, update `AWS_EC2_HOST` and the manual
deploy script defaults after any stop/start or instance replacement because the public IP
can change.

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
