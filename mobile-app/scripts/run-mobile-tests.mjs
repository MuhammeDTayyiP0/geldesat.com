#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

if (process.env.MOBILE_TEST_WORKER === '1') {
  globalThis.__DEV__ = false;

  const srcDir = join(root, 'src');
  const stubs = new Map([
    [
      'react-native',
      "export const Platform = { OS: 'ios', select: (spec) => spec.ios ?? spec.default };",
    ],
    ['expo-constants', 'export default { expoConfig: { extra: {} } };'],
    ['expo-router', 'export {};'],
  ]);

  const loaderSource = `
import { existsSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const srcDir = ${JSON.stringify(srcDir)};
const stubNames = new Set(${JSON.stringify([...stubs.keys()])});
const stubs = ${JSON.stringify(Object.fromEntries(stubs))};

function resolveTsFile(candidate) {
  for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
    const full = candidate + suffix;
    if (existsSync(full)) return pathToFileURL(full).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (stubNames.has(specifier)) {
    return { url: 'mobile-stub:' + specifier, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    const resolved = resolveTsFile(join(srcDir, specifier.slice(2)));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const baseDir = dirname(fileURLToPath(context.parentURL));
    const resolved = resolveTsFile(resolvePath(baseDir, specifier));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('mobile-stub:')) {
    const name = url.slice('mobile-stub:'.length);
    return { format: 'module', source: stubs[name], shortCircuit: true };
  }
  return nextLoad(url, context);
}
`;

  register(`data:text/javascript;base64,${Buffer.from(loaderSource).toString('base64')}`, pathToFileURL(import.meta.filename));
} else {
  const tests = [];

  function collect(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.isFile() && entry.name.endsWith('.test.ts')) tests.push(path);
    }
  }

  collect(join(root, 'src'));
  tests.sort();
  if (!tests.length) {
    console.error('No src/**/*.test.ts files were found.');
    process.exit(1);
  }

  console.log(`Running ${tests.length} mobile test files:`);
  for (const testPath of tests) console.log(`  ${relative(root, testPath)}`);

  const result = spawnSync(
    process.execPath,
    ['--import', './scripts/run-mobile-tests.mjs', '--test', ...tests],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, MOBILE_TEST_WORKER: '1' },
    },
  );
  process.exitCode = result.status ?? 1;
}
