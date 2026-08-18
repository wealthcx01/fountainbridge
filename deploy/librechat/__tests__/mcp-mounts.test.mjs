// FB-112. The MCP servers the composer uses are plain files bind-mounted into the LibreChat
// container one by one — there is no image build and no `npm install` step to notice a missing
// module. So a stdio entrypoint that imports a sibling module works perfectly on the host (where
// the whole directory exists) and fails to start inside the container (where only the files named
// in docker-compose.yml exist).
//
// That is exactly what FB-097 shipped: id allocation moved into `ticket-mcp/ids.mjs`, the filer
// imports it as `./ids.mjs`, and nothing mounted it. Unit tests passed — they run on the host.
// This test reads the two files that actually decide what the container sees and checks them
// against each other.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, resolve } from 'node:path';
import yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEPLOY_DIR = resolve(HERE, '..');

const compose = yaml.load(readFileSync(join(DEPLOY_DIR, 'docker-compose.yml'), 'utf8'));
const lcConfig = yaml.load(readFileSync(join(DEPLOY_DIR, 'librechat.yaml'), 'utf8'));

/**
 * Every `./host:/container[:ro]` bind mount on the api service, as {host, container} pairs.
 * Named volumes (no leading `.`) and anything not file-shaped are ignored.
 */
const mounts = (compose.services.api.volumes ?? [])
  .filter((v) => typeof v === 'string' && v.startsWith('./'))
  .map((v) => {
    const [host, container] = v.split(':');
    return { host, container };
  });

/** Container path -> host path, for the files the container can actually see. */
const byContainerPath = new Map(mounts.map((m) => [m.container, m.host]));

/** The stdio entrypoints LibreChat is configured to spawn, e.g. /app/foundry/ticket-filer.mjs. */
const entrypoints = Object.entries(lcConfig.mcpServers ?? {})
  .filter(([, s]) => s.command === 'node' && Array.isArray(s.args))
  .map(([name, s]) => ({ name, containerPath: s.args.find((a) => a.endsWith('.mjs')) }))
  .filter((e) => e.containerPath);

/**
 * Every way a file can pull in a sibling. A guard that only understood
 * `import x from './y.mjs'` would wave through the side-effect and dynamic forms — and this test
 * exists precisely because the unmounted-sibling failure is invisible until the container starts.
 */
const RELATIVE_IMPORT_PATTERNS = [
  /(?:^|[\s;])(?:import|export)\b[^'"]*?\bfrom\s*['"](\.[^'"]+)['"]/gm, // import x from / export * from
  /(?:^|[\s;])import\s*['"](\.[^'"]+)['"]/gm, //                          import './y.mjs' (side effect)
  /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gm, //                         await import('./y.mjs')
  /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gm, //                        require('./y.mjs')
];

/** The distinct relative specifiers a source file references, in any import form. */
function relativeImports(source) {
  const found = new Set();
  for (const pattern of RELATIVE_IMPORT_PATTERNS) {
    for (const [, specifier] of source.matchAll(pattern)) found.add(specifier);
  }
  return found;
}

describe('relativeImports', () => {
  it('sees every import form, and ignores bare specifiers', () => {
    const source = [
      "import readline from 'node:readline';", //          bare — not a sibling, must be ignored
      "import { a } from './ids.mjs';",
      "export { b } from './helpers.mjs';",
      "import './register.mjs';", //                        side effect, no `from`
      "const c = await import('./lazy.mjs');",
      "const d = require('./legacy.mjs');",
      "import e from '../shared/util.mjs';",
    ].join('\n');

    expect([...relativeImports(source)].sort()).toEqual([
      '../shared/util.mjs',
      './helpers.mjs',
      './ids.mjs',
      './lazy.mjs',
      './legacy.mjs',
      './register.mjs',
    ]);
  });
});

describe('librechat MCP bind mounts', () => {
  it('finds the stdio MCP servers to check', () => {
    // If this ever goes to zero the rest of the file passes vacuously, which would be worse than
    // failing — it would read as "all mounts fine" while checking nothing.
    expect(entrypoints.length).toBeGreaterThan(0);
  });

  it.each(entrypoints)('$name is mounted, and so is every module it imports', ({ containerPath }) => {
    const hostPath = byContainerPath.get(containerPath);
    expect(hostPath, `librechat.yaml spawns ${containerPath}, which no volume mounts`).toBeDefined();

    const source = readFileSync(join(DEPLOY_DIR, hostPath), 'utf8');
    const containerDir = posix.dirname(containerPath);

    for (const specifier of relativeImports(source)) {
      // Resolve the import the way node will *inside the container*, not on this machine.
      const importedInContainer = posix.normalize(posix.join(containerDir, specifier));
      const importedOnHost = byContainerPath.get(importedInContainer);

      expect(
        importedOnHost,
        `${containerPath} imports '${specifier}' -> ${importedInContainer}, which no volume ` +
          `mounts. The container has no image build and no install step, so this fails at ` +
          `startup and the tool disappears from the composer.`,
      ).toBeDefined();

      expect(
        existsSync(join(DEPLOY_DIR, importedOnHost)),
        `${importedInContainer} is mounted from ${importedOnHost}, which does not exist`,
      ).toBe(true);
    }
  });

  it('mounts no file that is missing on the host', () => {
    // A bind mount whose source is absent does not fail loudly: docker creates an empty directory
    // at the target, so the tool "exists" and behaves like an empty file.
    const missing = mounts.filter((m) => !existsSync(join(DEPLOY_DIR, m.host))).map((m) => m.host);
    expect(missing).toEqual([]);
  });
});
