import { execSync, spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
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

console.log(`[Cloudflare Deploy] Mode: ${mode}`);
console.log(`[Cloudflare Deploy] Target Pages branch: ${targetBranch}`);

run('npm', ['run', 'build']);
run('npx', [
  'wrangler',
  'pages',
  'deploy',
  'dist',
  '--project-name=nearhub',
  `--branch=${targetBranch}`,
]);

