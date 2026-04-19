// Minimal .env.local loader (no dep). Silently skips if file missing.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export async function loadDotEnv(root) {
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    const raw = await readFile(p, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue; // don't override explicit env
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
