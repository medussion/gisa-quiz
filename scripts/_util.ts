import fs from 'node:fs';
import path from 'node:path';

export const REJECTED_DIR = 'data/rejected';
export const NORMALIZED_DIR = 'data/normalized';

/** data/normalized/*.json 을 모두 합쳐 읽는다. 인자로 파일을 지정하면 그 파일만 읽는다. */
export function loadQuestionFiles(explicit?: string): { file: string; data: unknown }[] {
  if (explicit) {
    return [{ file: explicit, data: JSON.parse(fs.readFileSync(explicit, 'utf8')) }];
  }
  if (!fs.existsSync(NORMALIZED_DIR)) return [];
  return fs
    .readdirSync(NORMALIZED_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const file = path.join(NORMALIZED_DIR, f);
      return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    });
}

export function writeRejected(name: string, payload: unknown) {
  fs.mkdirSync(REJECTED_DIR, { recursive: true });
  const out = path.join(REJECTED_DIR, name);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return out;
}

export function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
}
