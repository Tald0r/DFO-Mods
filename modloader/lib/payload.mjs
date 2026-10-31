// An explicit, immutable renderer payload. No stock-store reads or fallbacks.
import fs from 'node:fs';
import path from 'node:path';
import { sha256, GAME_ENTRY } from './game.mjs';

export function safePayloadPath(rel) {
  return typeof rel === 'string' && rel.length > 0 && !rel.includes('\\') && !rel.includes(':')
    && !/[\u0000-\u001f]/.test(rel) && rel.split('/').every(p => p && p !== '.' && p !== '..');
}
export function openPayload(root) {
  root = fs.realpathSync(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'renderer-payload.json'), 'utf8'));
  if (manifest.format !== 1 || typeof manifest.version !== 'string' || !Array.isArray(manifest.files)) throw Error('Invalid renderer payload manifest');
  const entries = new Map();
  for (const f of manifest.files) {
    if (!safePayloadPath(f.path) || entries.has(f.path) || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw Error('Invalid renderer payload file');
    entries.set(f.path, { ...f, own: true });
  }
  if (!entries.has(GAME_ENTRY)) throw Error('Renderer payload has no game entry');
  const mods = manifest.mods ?? [];
  if (!Array.isArray(mods) || mods.some(m => typeof m.id !== 'string' || typeof m.name !== 'string' || !safePayloadPath(m.module) || !entries.has(m.module))) throw Error('Invalid renderer payload mods');
  if (new Set(mods.map(m => m.id)).size !== mods.length) throw Error('Duplicate renderer payload mod');
  const payload = {
    version: manifest.version, files: [...entries.values()],
    registry: mods.map(m => ({id:m.id,name:m.name,spec:'../../'+m.module})),
    read(rel) {
      const f = entries.get(rel); if (!f) return null;
      const target = path.join(root, rel), real = fs.realpathSync(target);
      if (real !== target || !real.startsWith(root + path.sep)) throw Error('Renderer payload links are not allowed');
      const bytes = fs.readFileSync(real);
      if (bytes.length !== f.size || sha256(bytes) !== f.sha256) throw Error(`Renderer payload changed: ${rel}`);
      return bytes;
    },
  };
  for (const rel of entries.keys()) payload.read(rel);
  return payload;
}
