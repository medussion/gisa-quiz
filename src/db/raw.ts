import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/** CLI 스크립트용 커넥션 ('server-only' 없이 tsx에서 직접 사용) */
export function openDb(dbPathOverride?: string) {
  const dbPath = path.resolve(dbPathOverride ?? process.env.DATABASE_PATH ?? './data/app.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return { sqlite, db: drizzle(sqlite, { schema }), dbPath };
}
