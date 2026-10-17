---
description: 'Use when editing shared zod schemas and types used by both web and api (packages/shared).'
applyTo: 'packages/shared/**'
---

# Shared スキーマ ルール

- web と api の両方が依存する契約。変更したら両方の利用箇所を検索して影響を確認する
- スキーマを先に定義し、型は `z.infer` で生成する
- ユーザー向けのエラーメッセージは日本語でスキーマに書く (フォームでそのまま表示される)
- `src/index.ts` から export し、`src/*.test.ts` に境界値のテストを追加する
- 変更後は `dist` を再生成する必要がある (turbo の `^build` が自動で行う)
