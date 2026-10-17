# Project Guidelines

## Architecture

- pnpm + Turborepo のモノレポ。Todo アプリを題材にフルスタックを学ぶリポジトリ
- `apps/web`: Next.js 16 / React 19 / Tailwind 4 (cacheComponents 有効)
- `apps/api`: Hono。`src/index.ts` の default export が Vercel Function になる。保存先は `src/store.ts` の `TodoStore` で差し替え
- `packages/db`: Drizzle + Neon (HTTP ドライバ)。`packages/shared`: web と api で共有する zod スキーマ
- 依存の向き: `apps/*` → `packages/*`。`packages/*` から `apps/*` を参照しない

## Build and Test

- 検証: `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` (まとめて実行するなら `verify` スキル)
- DB: `pnpm --filter @repo/db db:generate` (SQL 生成) / `db:migrate` (適用。本番 DB に効くので要確認)
- デプロイ: GitHub の main → Vercel (web と api は別プロジェクト)。手順は `deploy-vercel` スキル

## Conventions

- コミットメッセージは `feat:` `fix:` `docs:` `chore:` で始める (Husky が検査)
- 入力検証は `packages/shared` のスキーマを web と api の両方で使う。型は `z.infer` で生成し二重管理しない
- 秘密情報は `.env` に置き、読まない・表示しない・コミットしない。雛形は `.env.example`
- Next.js はバージョン固有の変更が多い。`apps/web/AGENTS.md` に従い、書く前に `node_modules/next/dist/docs/` を確認する
