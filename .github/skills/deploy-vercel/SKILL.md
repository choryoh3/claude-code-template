---
name: deploy-vercel
description: 'GitHub → Vercel へのデプロイ手順とチェックリスト (web / api の 2 プロジェクト、Neon、環境変数、CORS、マイグレーション)。Use when: デプロイ、Vercel の設定、環境変数の追加、本番で動かない、CORS エラー、マイグレーションの適用。'
---

# Deploy to Vercel

## 構成

| Vercel プロジェクト | Root Directory | Framework | 環境変数 |
|---|---|---|---|
| api (`claude-code-template`) | `apps/api` | Hono | `DATABASE_URL` (Neon 連携で自動), `WEB_ORIGIN` |
| web (`claude-code-template-web`) | `apps/web` | Next.js | `NEXT_PUBLIC_API_URL` |

- main への push で両方が自動デプロイされる。PR ごとに Preview デプロイが作られる
- 環境変数はデプロイ時に読み込まれる。変更したら **Redeploy** が必要 (`NEXT_PUBLIC_*` はビルド時に埋め込まれる)

## リリース前チェックリスト

1. `node .github/skills/verify/scripts/verify.cjs --build` がすべて ✅
2. 新しい環境変数がある → `.env.example` に追記し、Vercel の該当プロジェクトにも登録した
3. DB スキーマの変更がある → `db:generate` の生成物をコミットした
4. マイグレーションの適用順を決めた: **後方互換な変更は「マイグレーション → デプロイ」**、列の削除は「デプロイ → マイグレーション」
5. API の入出力を変えた → 古い web から呼ばれても壊れないか確認した (web と api は別々にデプロイされる)

## リリース手順 (ユーザーが実行)

1. コミット (`feat:` などで始める) → feature ブランチを push → PR → Preview で確認 → main にマージ
2. マイグレーションがある場合: `packages/db/.env` に本番の接続文字列がある状態で `pnpm --filter @repo/db db:migrate`
3. Vercel の Deployments で両プロジェクトが Ready になったことを確認する
4. 動作確認: `https://<api>/health` が `{"status":"ok"}` / web で追加・完了・削除・再読み込み

## トラブルシューティング

| 症状 | 確認すること |
|---|---|
| 画面に「API に接続できません」 | web の `NEXT_PUBLIC_API_URL` (末尾 `/` なし・https) → Redeploy |
| ブラウザで CORS エラー | api の `WEB_ORIGIN` が web の URL と完全一致か → Redeploy。Preview の URL は一致しない |
| データが消える | api の Logs に `DATABASE_URL が未設定` が出ていないか |
| `Cannot find module '@repo/shared'` | Build Command を `cd ../.. && pnpm turbo run build --filter=<pkg>` に |
| 500 エラー | api の Logs → マイグレーション未適用 (テーブルがない) が多い |
