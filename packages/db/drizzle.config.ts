import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) process.loadEnvFile('.env');

// drizzle-kit (マイグレーション生成・適用ツール) の設定。
// DATABASE_URL は Neon の接続文字列 (.env に書く。コミットしない)。
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
