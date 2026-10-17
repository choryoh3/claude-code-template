---
name: verify
description: 'typecheck / lint / test / build をまとめて実行し、失敗箇所だけを要約して表示する検証手順。Use when: 実装後の検証、コミット前チェック、CI が落ちた原因調査、特定パッケージだけ検証したい。'
argument-hint: '--filter @repo/api や --build などのオプション'
---

# Verify

## 手順

1. 変更したパッケージだけを検証する (速い)
   ```powershell
   node .github/skills/verify/scripts/verify.cjs --filter @repo/api
   ```
   `--filter` は複数指定できる。依存パッケージ (`@repo/shared` など) は turbo が自動でビルドする
2. 統合前・コミット前は全体を検証する。デプロイに関わる変更なら `--build` を付ける
   ```powershell
   node .github/skills/verify/scripts/verify.cjs --build
   ```
3. ❌ が出たら、表示されたエラーの先頭から直す。型エラー → lint → テスト の順に直すと効率がよい
4. 結果は ✅ / ❌ の一覧で報告する

## オプション

| オプション | 内容 |
|---|---|
| `--filter <pkg>` | 対象パッケージを絞る (`@repo/api`, `@repo/web`, `@repo/db`, `@repo/shared`) |
| `--build` | `build` も実行する (Next.js の本番ビルドを含む) |
| `--only <task>` | 1 つのタスクだけ実行する (`typecheck` / `lint` / `test` / `build`) |

[スクリプト本体](./scripts/verify.cjs)
