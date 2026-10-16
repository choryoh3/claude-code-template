import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// Vercel のサーバーレス関数は実行のたびに起動するため、常時接続の TCP ではなく
// HTTP 経由でクエリを送る Neon のドライバを使う (接続数の枯渇を避けられる)。
export function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema });
}

export type Database = ReturnType<typeof createDb>;
