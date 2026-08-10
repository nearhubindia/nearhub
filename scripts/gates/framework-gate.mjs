#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const errors = [];

function toAbsolute(relPath) {
  return path.join(repoRoot, relPath);
}

function exists(relPath) {
  return fs.existsSync(toAbsolute(relPath));
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(toAbsolute(relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(toAbsolute(relPath), 'utf8');
}

function addError(message) {
  errors.push(message);
}

function requirePackageScripts(projectDir, scripts) {
  const packageJsonPath = `${projectDir}/package.json`;
  if (!exists(packageJsonPath)) {
    addError(`Missing ${packageJsonPath}`);
    return;
  }

  const pkg = readJson(packageJsonPath);
  for (const scriptName of scripts) {
    if (!pkg.scripts || typeof pkg.scripts[scriptName] !== 'string') {
      addError(`Missing script "${scriptName}" in ${packageJsonPath}`);
    }
  }
}

function checkAppFrameworkContracts() {
  const packageJsonPath = 'app/package.json';
  const appJsonPath = 'app/app.json';

  if (!exists(packageJsonPath) || !exists(appJsonPath)) {
    addError('app/package.json or app/app.json is missing');
    return;
  }

  const pkg = readJson(packageJsonPath);
  const appJson = readJson(appJsonPath);

  if (pkg.main !== 'expo-router/entry') {
    addError(
      `app/package.json main must be "expo-router/entry" (found: ${String(pkg.main || '')})`
    );
  }

  const plugins = appJson?.expo?.plugins;
  const hasExpoRouterPlugin = Array.isArray(plugins)
    ? plugins.some((entry) => {
        if (typeof entry === 'string') return entry === 'expo-router';
        return Array.isArray(entry) && entry[0] === 'expo-router';
      })
    : false;
  if (!hasExpoRouterPlugin) {
    addError('app/app.json must include the "expo-router" plugin');
  }

  if (!exists('app/src/app/_layout.tsx')) {
    addError('Missing app/src/app/_layout.tsx (Expo Router root layout)');
  }
}

function checkWebFrameworkContracts() {
  const packageJsonPath = 'web/package.json';
  if (!exists(packageJsonPath)) {
    addError('Missing web/package.json');
    return;
  }

  const pkg = readJson(packageJsonPath);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  const requiredDeps = ['react', 'react-dom', 'react-router-dom', 'vite'];
  for (const dep of requiredDeps) {
    if (!deps[dep]) {
      addError(`web/package.json missing required dependency/devDependency "${dep}"`);
    }
  }

  if (!exists('web/vite.config.ts')) {
    addError('Missing web/vite.config.ts');
  }

  if (!exists('web/src/App.tsx')) {
    addError('Missing web/src/App.tsx');
  } else {
    const appSource = readText('web/src/App.tsx');
    if (!/BrowserRouter/.test(appSource) || !/Routes/.test(appSource)) {
      addError('web/src/App.tsx should define router wiring via BrowserRouter and Routes');
    }
  }
}

function checkServerFrameworkContracts() {
  const packageJsonPath = 'server/package.json';
  if (!exists(packageJsonPath)) {
    addError('Missing server/package.json');
    return;
  }

  const pkg = readJson(packageJsonPath);
  if (!pkg.dependencies || !pkg.dependencies.express) {
    addError('server/package.json must include express dependency');
  }

  if (!exists('server/routes.ts')) {
    addError('Missing server/routes.ts');
  } else {
    const routesSource = readText('server/routes.ts');
    if (!/export\s+async\s+function\s+registerRoutes\s*\(/.test(routesSource)) {
      addError('server/routes.ts must export registerRoutes(app)');
    }
  }

  if (!exists('server/index.ts')) {
    addError('Missing server/index.ts');
  } else {
    const indexSource = readText('server/index.ts');
    if (!/registerRoutes\s*\(/.test(indexSource)) {
      addError('server/index.ts should call registerRoutes(app)');
    }
  }
}

requirePackageScripts('app', ['type-check', 'lint', 'format:check']);
requirePackageScripts('server', ['type-check', 'lint', 'format:check', 'test:unit', 'test:coverage']);
requirePackageScripts('web', ['type-check', 'lint', 'format:check', 'test', 'test:coverage', 'e2e']);

checkAppFrameworkContracts();
checkWebFrameworkContracts();
checkServerFrameworkContracts();

if (errors.length > 0) {
  console.error('\n❌ Framework Gate failed:\n');
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  console.error('\nFix the issues above before pushing.\n');
  process.exit(1);
}

console.log('✅ Framework Gate passed');
