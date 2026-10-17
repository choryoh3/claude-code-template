---
description: 'Use when changing the database schema, Drizzle queries, or migrations (packages/db).'
applyTo: 'packages/db/**'
---

# DB (Drizzle + Neon) ルール

- スキーマ変更は `src/schema.ts` を編集 → `pnpm --filter @repo/db db:generate` で SQL を生成し、生成物もコミットする
- 生成済みのマイグレーション (`drizzle/*.sql`, `drizzle/meta/*`) を手で書き換えない
- `db:migrate` は `.env` の DB (本番の可能性あり) に適用される。実行前に必ずユーザーの確認を取る
- 列の削除や型変更は破壊的変更。「列を追加 → コードを移行 → 古い列を削除」の段階リリースを提案する
- 他パッケージに必要な drizzle-orm の演算子は `src/index.ts` から再エクスポートする
