#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const errors = [];

const WALK_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.expo',
  'android',
  'ios',
  '.wrangler',
  '.tmp',
  'release',
]);

function toAbsolute(relPath) {
  return path.join(repoRoot, relPath);
}

function exists(relPath) {
  return fs.existsSync(toAbsolute(relPath));
}

function readText(relPath) {
  return fs.readFileSync(toAbsolute(relPath), 'utf8');
}

function addError(message) {
  errors.push(message);
}

function walk(relDir, visitor) {
  const absDir = toAbsolute(relDir);
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const childRel = path.posix.join(relDir, entry.name).replace(/\\/g, '/');
    visitor(childRel, entry);
    if (entry.isDirectory() && !WALK_SKIP_DIRS.has(entry.name)) {
      walk(childRel, visitor);
    }
  }
}

function collectFiles(startRel, matcher) {
  const results = [];
  walk(startRel, (relPath, entry) => {
    if (entry.isFile() && matcher(relPath)) {
      results.push(relPath);
    }
  });
  return results;
}

function checkNoNestedGitDirs() {
  const nestedGitDirs = [];
  walk('.', (relPath, entry) => {
    if (entry.isDirectory() && relPath !== '.git' && entry.name === '.git') {
      nestedGitDirs.push(relPath);
    }
  });

  if (nestedGitDirs.length > 0) {
    addError(
      `Nested git directories found: ${nestedGitDirs.join(', ')}. Keep a single repo root.`
    );
  }
}

function checkNoRouteRegistrationInsideServices() {
  const serviceFiles = collectFiles(
    'server/features',
    (relPath) => /\/services\/.*\.(ts|tsx|js|mjs|cjs)$/.test(relPath)
  );

  const routePattern = /\bapp\.(get|post|put|patch|delete|use)\s*\(/;
  for (const file of serviceFiles) {
    const lines = readText(file).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (routePattern.test(lines[i])) {
        addError(
          `Route registration found in service layer: ${file}:${i + 1}. Move endpoint wiring to routes/.`
        );
        break;
      }
    }
  }
}

function checkServerRouteImportsComeFromRoutesLayer() {
  const routesFile = 'server/routes.ts';
  if (!exists(routesFile)) {
    addError('Missing server/routes.ts');
    return;
  }

  const lines = readText(routesFile).split('\n');
  const routeImportPattern =
    /import\s+\{[^}]*register[A-Za-z0-9_]*Routes[^}]*\}\s+from\s+['"][^'"]*\/services\/[^'"]*['"]/;

  for (let i = 0; i < lines.length; i++) {
    if (routeImportPattern.test(lines[i])) {
      addError(
        `Route module imported from services layer in ${routesFile}:${i + 1}. Import from routes/.`
      );
    }
  }
}

function checkAppLegacyRouteRootsAbsent() {
  const legacyRouteFiles = [
    'app/_layout.tsx',
    'app/+not-found.tsx',
    'app/+native-intent.tsx',
    'app/(tabs)/_layout.tsx',
    'app/(tabs)/index.tsx',
    'app/(tabs)/create.tsx',
    'app/(tabs)/shorts.tsx',
    'app/(tabs)/saved.tsx',
    'app/(tabs)/profile-menu.tsx',
    'app/auth/register.tsx',
    'app/auth/verify-otp.tsx',
    'app/auth/select-plan.tsx',
    'app/auth/complete-profile.tsx',
    'app/chat/[listingId].tsx',
    'app/listing/[id].tsx',
    'app/user/[userId].tsx',
  ];

  const presentLegacyFiles = legacyRouteFiles.filter((relPath) => exists(relPath));
  if (presentLegacyFiles.length > 0) {
    addError(
      `Legacy Expo Router files detected outside app/src/app: ${presentLegacyFiles.join(', ')}`
    );
  }
}

function resolveAliasTarget(aliasPath) {
  const withoutAlias = aliasPath.replace(/^@\//, 'app/');
  const candidates = [
    `${withoutAlias}.tsx`,
    `${withoutAlias}.ts`,
    path.posix.join(withoutAlias, 'index.tsx'),
    path.posix.join(withoutAlias, 'index.ts'),
  ];
  return candidates.find((relPath) => exists(relPath));
}

function checkAppRouteReexportMappings() {
  const routeFiles = collectFiles(
    'app/src/app',
    (relPath) => relPath.endsWith('.tsx') || relPath.endsWith('.ts')
  );
  const reexportPattern =
    /export\s*\{\s*default\s*\}\s*from\s*['"](@\/[^'"]+)['"]/;

  for (const routeFile of routeFiles) {
    const source = readText(routeFile);
    const match = source.match(reexportPattern);
    if (!match) continue;
    const aliasTarget = match[1];
    const resolved = resolveAliasTarget(aliasTarget);
    if (!resolved) {
      addError(
        `Broken route re-export mapping in ${routeFile}. Target not found for ${aliasTarget}.`
      );
    }
  }
}

function checkDuplicateServerMethodPathMappings() {
  const routeFiles = [
    ...collectFiles(
      'server/features',
      (relPath) => relPath.endsWith('.ts') || relPath.endsWith('.tsx') || relPath.endsWith('.js')
    ),
    'server/routes.ts',
    'server/index.ts',
  ].filter((relPath) => exists(relPath));

  const routeMap = new Map();
  const routeMatcher = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of routeFiles) {
    const text = readText(file);
    let match;
    while ((match = routeMatcher.exec(text)) !== null) {
      const key = `${match[1].toUpperCase()} ${match[2]}`;
      if (!routeMap.has(key)) routeMap.set(key, []);
      routeMap.get(key).push(file);
    }
  }

  for (const [key, files] of routeMap.entries()) {
    if (files.length > 1) {
      addError(`Duplicate server route mapping: ${key} in ${files.join(', ')}`);
    }
  }
}

checkNoNestedGitDirs();
checkNoRouteRegistrationInsideServices();
checkServerRouteImportsComeFromRoutesLayer();
checkAppLegacyRouteRootsAbsent();
checkAppRouteReexportMappings();
checkDuplicateServerMethodPathMappings();

if (errors.length > 0) {
  console.error('\n❌ Architecture Gate failed:\n');
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  console.error('\nFix the issues above before pushing.\n');
  process.exit(1);
}

console.log('✅ Architecture Gate passed');
