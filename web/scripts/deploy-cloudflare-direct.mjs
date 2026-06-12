import { execFileSync, execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? webRoot,
    stdio: 'inherit',
    shell: false,
    env: options.env ?? process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function hydrateEnv() {
  loadEnvFile(path.join(webRoot, '.env.deploy'));
  loadEnvFile(path.join(webRoot, '.env.deploy.local'));
  loadEnvFile(path.join(repoRoot, '.env'));
  loadEnvFile(path.join(repoRoot, '.env.local'));
  loadEnvFile(path.join(repoRoot, 'server', '.env'));
  loadEnvFile(path.join(repoRoot, 'server', '.env.local'));
  loadEnvFile(path.join(webRoot, '.env'));
  loadEnvFile(path.join(webRoot, '.env.local'));
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function getCommitHash() {
  return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function getCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'Direct API deploy';
  }
}

function isGitDirty() {
  try {
    execSync('git diff --quiet && git diff --cached --quiet', { cwd: repoRoot, stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
}

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const absolutePath = path.join(dir, name);
    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      walk(absolutePath, base, out);
    } else {
      out.push({
        absolutePath,
        relativePath: path.relative(base, absolutePath).split(path.sep).join('/'),
      });
    }
  }
  return out;
}

function hashAsset(buffer, relativePath) {
  const extension = path.extname(relativePath).slice(1);
  return crypto
    .createHash('sha256')
    .update(buffer.toString('base64') + extension)
    .digest('hex')
    .slice(0, 32);
}

function getContentType(relativePath) {
  if (relativePath.endsWith('.html')) return 'text/html';
  if (relativePath.endsWith('.css')) return 'text/css';
  if (relativePath.endsWith('.js')) return 'application/javascript';
  if (relativePath.endsWith('.json')) return 'application/json';
  if (relativePath.endsWith('.xml')) return 'application/xml';
  if (relativePath.endsWith('.txt')) return 'text/plain';
  if (relativePath.endsWith('.svg')) return 'image/svg+xml';
  if (relativePath.endsWith('.png')) return 'image/png';
  if (relativePath.endsWith('.jpg') || relativePath.endsWith('.jpeg')) return 'image/jpeg';
  if (relativePath.endsWith('.webp')) return 'image/webp';
  if (relativePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function bucketFiles(files) {
  const maxBucketSize = 40 * 1024 * 1024;
  const maxBucketFiles = 2000;
  const buckets = [];

  for (const file of [...files].sort((a, b) => b.size - a.size)) {
    let placed = false;
    for (const bucket of buckets) {
      if (bucket.remainingSize >= file.size && bucket.files.length < maxBucketFiles) {
        bucket.files.push(file);
        bucket.remainingSize -= file.size;
        placed = true;
        break;
      }
    }

    if (!placed) {
      buckets.push({
        files: [file],
        remainingSize: maxBucketSize - file.size,
      });
    }
  }

  return buckets.map((bucket) => bucket.files);
}

async function cf(pathname, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    method,
    headers,
    body,
  });
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok || json.success === false) {
    throw new Error(`Cloudflare ${method} ${pathname} failed: ${response.status} ${text}`);
  }

  return json.result ?? json;
}

function findWranglerCli() {
  if (process.env.WRANGLER_CLI_PATH && fs.existsSync(process.env.WRANGLER_CLI_PATH)) {
    return process.env.WRANGLER_CLI_PATH;
  }

  const npxRoot = path.join(os.homedir(), '.npm', '_npx');
  if (!fs.existsSync(npxRoot)) {
    throw new Error('Unable to locate Wrangler CLI cache. Set WRANGLER_CLI_PATH to continue.');
  }

  const candidates = [];
  for (const entry of fs.readdirSync(npxRoot)) {
    const candidate = path.join(
      npxRoot,
      entry,
      'node_modules',
      'wrangler',
      'wrangler-dist',
      'cli.js'
    );
    if (fs.existsSync(candidate)) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    throw new Error('Unable to locate Wrangler CLI cache. Set WRANGLER_CLI_PATH to continue.');
  }

  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0];
}

function buildFunctionsBundle(distDir) {
  const functionsDir = path.join(webRoot, 'functions');
  if (!fs.existsSync(functionsDir)) {
    return null;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nearhub-pages-'));
  const bundlePath = path.join(tempRoot, 'nearhub-worker.bundle');
  const routingConfigPath = path.join(tempRoot, 'functions-filepath-routing-config.json');
  const routesPath = path.join(tempRoot, 'nearhub-routes.json');
  const wranglerCli = findWranglerCli();

  const wranglerHome = path.join(os.tmpdir(), 'nearhub-wrangler-home');
  const wranglerConfigDir = path.join(wranglerHome, '.config', '.wrangler', 'logs');
  fs.mkdirSync(wranglerConfigDir, { recursive: true });

  run(
    'node',
    [
      wranglerCli,
      'pages',
      'functions',
      'build',
      functionsDir,
      '--outfile',
      bundlePath,
      '--output-config-path',
      routingConfigPath,
      '--output-routes-path',
      routesPath,
      '--build-output-directory',
      distDir,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: wranglerHome,
      },
    }
  );

  return {
    bundlePath,
    routingConfigPath,
    routesPath,
  };
}

async function uploadStaticAssets({ accountId, projectName, token, distDir }) {
  const files = walk(distDir).map(({ absolutePath, relativePath }) => {
    const buffer = fs.readFileSync(absolutePath);
    return {
      absolutePath,
      relativePath,
      buffer,
      size: buffer.length,
      hash: hashAsset(buffer, relativePath),
      contentType: getContentType(relativePath),
    };
  });

  const jwt = (
    await cf(`/accounts/${accountId}/pages/projects/${projectName}/upload-token`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).jwt;

  const missing = await cf('/pages/assets/check-missing', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hashes: files.map((file) => file.hash) }),
  });

  const missingSet = new Set(missing);
  const filesToUpload = files.filter((file) => missingSet.has(file.hash));
  console.log(`[Cloudflare Direct] Missing assets: ${filesToUpload.length}/${files.length}`);

  for (const bucket of bucketFiles(filesToUpload)) {
    await cf('/pages/assets/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        bucket.map((file) => ({
          key: file.hash,
          value: file.buffer.toString('base64'),
          metadata: { contentType: file.contentType },
          base64: true,
        }))
      ),
    });
  }

  await cf('/pages/assets/upsert-hashes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hashes: files.map((file) => file.hash) }),
  });

  return Object.fromEntries(files.map((file) => [`/${file.relativePath}`, file.hash]));
}

async function createDeployment({
  accountId,
  projectName,
  token,
  branch,
  manifest,
  functionsBundle,
}) {
  const form = new FormData();
  form.append('manifest', JSON.stringify(manifest));
  form.append('branch', branch);
  form.append('commit_hash', getCommitHash());
  form.append('commit_message', getCommitMessage().slice(0, 384));
  form.append('commit_dirty', String(isGitDirty()));

  const redirectsPath = path.join(webRoot, 'dist', '_redirects');
  if (fs.existsSync(redirectsPath)) {
    form.append('_redirects', new Blob([fs.readFileSync(redirectsPath)]), '_redirects');
  }

  const headersPath = path.join(webRoot, 'dist', '_headers');
  if (fs.existsSync(headersPath)) {
    form.append('_headers', new Blob([fs.readFileSync(headersPath)]), '_headers');
  }

  if (functionsBundle) {
    form.append(
      'functions-filepath-routing-config.json',
      new Blob([fs.readFileSync(functionsBundle.routingConfigPath)]),
      'functions-filepath-routing-config.json'
    );
    form.append(
      '_worker.bundle',
      new Blob([fs.readFileSync(functionsBundle.bundlePath)]),
      '_worker.bundle'
    );
    form.append(
      '_routes.json',
      new Blob([fs.readFileSync(functionsBundle.routesPath)]),
      '_routes.json'
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected Cloudflare response: ${text}`);
  }

  if (!response.ok || json.success === false) {
    throw new Error(`Cloudflare deployment failed: ${response.status} ${text}`);
  }

  return json.result;
}

async function waitForDeployment({ accountId, projectName, token, deploymentId }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const deployment = await cf(
      `/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const status = deployment.latest_stage?.status;
    console.log(`[Cloudflare Direct] Deployment status: ${status ?? 'unknown'}`);

    if (status === 'success') {
      return deployment;
    }

    if (status === 'failure') {
      throw new Error(`Deployment ${deploymentId} failed`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timed out waiting for deployment ${deploymentId}`);
}

async function main() {
  hydrateEnv();

  const mode = process.argv[2] === 'preview' ? 'preview' : 'production';
  const currentBranch = getCurrentBranch();
  const branch =
    mode === 'production'
      ? 'main'
      : currentBranch && currentBranch !== 'main'
        ? currentBranch
        : 'api-direct-preview';
  const distDir = path.join(webRoot, 'dist');

  const token = getRequiredEnv('CLOUDFLARE_API_TOKEN');
  const accountId = getRequiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'nearhub';

  console.log(`[Cloudflare Direct] Mode: ${mode}`);
  console.log(`[Cloudflare Direct] Project: ${projectName}`);
  console.log(`[Cloudflare Direct] Branch: ${branch}`);

  run('npm', ['run', 'build']);

  const functionsBundle = buildFunctionsBundle(distDir);
  const manifest = await uploadStaticAssets({
    accountId,
    projectName,
    token,
    distDir,
  });

  const deployment = await createDeployment({
    accountId,
    projectName,
    token,
    branch,
    manifest,
    functionsBundle,
  });

  console.log(`[Cloudflare Direct] Deployment created: ${deployment.id}`);
  const finalDeployment = await waitForDeployment({
    accountId,
    projectName,
    token,
    deploymentId: deployment.id,
  });

  console.log(`[Cloudflare Direct] URL: ${finalDeployment.url}`);
  console.log(`[Cloudflare Direct] uses_functions: ${finalDeployment.uses_functions}`);

  if (!finalDeployment.uses_functions) {
    throw new Error('Deployment completed without Pages Functions enabled');
  }
}

main().catch((error) => {
  console.error(`[Cloudflare Direct] ${error.message}`);
  process.exit(1);
});
