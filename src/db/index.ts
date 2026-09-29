import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export const dbPath = path.resolve(process.env.DATABASE_PATH ?? './data/app.db');

function createConnection() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

type DbType = ReturnType<typeof createConnection>;

// dev의 HMR에서 커넥션이 계속 늘어나지 않도록 전역에 캐시한다.
const globalForDb = globalThis as unknown as { __gisaDb?: DbType };
export const db: DbType = globalForDb.__gisaDb ?? createConnection();
if (process.env.NODE_ENV !== 'production') globalForDb.__gisaDb = db;

export { schema };
