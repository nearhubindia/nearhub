import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, 'utf-8');
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

function hydrateDeployEnv() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..', '..');

  loadEnvFile(path.join(repoRoot, 'web', '.env.deploy'));
  loadEnvFile(path.join(repoRoot, 'web', '.env.deploy.local'));
  loadEnvFile(path.join(repoRoot, '.env'));
  loadEnvFile(path.join(repoRoot, '.env.local'));
  loadEnvFile(path.join(repoRoot, 'server', '.env'));
  loadEnvFile(path.join(repoRoot, 'server', '.env.local'));
  loadEnvFile(path.join(repoRoot, 'web', '.env'));
  loadEnvFile(path.join(repoRoot, 'web', '.env.local'));
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function resolveMode() {
  const cliMode = process.argv[2];
  if (cliMode === 'prod' || cliMode === 'production') return 'production';
  if (cliMode === 'preview') return 'preview';

  const branch = getCurrentBranch();
  return branch === 'main' ? 'production' : 'preview';
}

function resolveTargetBranch(mode) {
  if (mode === 'production') return 'main';

  const branch = getCurrentBranch();
  return branch && branch !== 'HEAD' ? branch : 'master';
}

const mode = resolveMode();
const targetBranch = resolveTargetBranch(mode);
hydrateDeployEnv();

const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'nearhub';

console.log(`[Cloudflare Deploy] Mode: ${mode}`);
console.log(`[Cloudflare Deploy] Target Pages branch: ${targetBranch}`);
console.log(`[Cloudflare Deploy] Pages project: ${projectName}`);

run('npm', ['run', 'build']);
run('npx', [
  'wrangler',
  'pages',
  'deploy',
  'dist',
  `--project-name=${projectName}`,
  `--branch=${targetBranch}`,
]);
