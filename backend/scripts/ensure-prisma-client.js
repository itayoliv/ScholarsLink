import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const clientDir = path.join(backendRoot, 'node_modules', '.prisma', 'client');
const indexJs = path.join(clientDir, 'index.js');
const engine = path.join(clientDir, 'query_engine-windows.dll.node');

function clientLooksReady() {
  try {
    if (!fs.existsSync(indexJs) || !fs.existsSync(engine)) {
      return false;
    }
    return fs.statSync(indexJs).size > 5000;
  } catch {
    return false;
  }
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate', '--schema', 'prisma/schema.prisma'],
  { cwd: backendRoot, encoding: 'utf8', shell: true },
);

if (result.status === 0) {
  process.exit(0);
}

const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
const looksLikeLock = /EPERM|operation not permitted|EBUSY|resource busy|cannot access/i.test(combined);

if (clientLooksReady() && looksLikeLock) {
  console.warn('Prisma generate could not overwrite the engine (file lock). Reusing existing Prisma client.');
  console.warn('Close other ScholarsLink Backend windows if you need a fresh generate.');
  process.exit(0);
}

console.error(combined.trim() || 'prisma generate failed.');
process.exit(result.status || 1);
