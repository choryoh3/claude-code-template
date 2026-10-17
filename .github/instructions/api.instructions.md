---
description: 'Use when editing the Hono API (apps/api): routes, validation, CORS, TodoStore, Vercel Function entry.'
applyTo: 'apps/api/**'
---

# API (Hono) ルール

- ルートは `createApp()` 内のメソッドチェーンで追加する (`AppType` の型を保つため)
- 入力は `zValidator('json' | 'param' | 'query', schema)` で検証し、`c.req.valid()` から取り出す。body/params を直接読まない
- 永続化は `TodoStore` 経由のみ。新しい操作はインターフェース → `createMemoryStore` → `createDbStore` の順に追加する
- エラー応答は `c.json({ error: '...' }, status)`。存在しない ID は 404、形式不正は 400
- 環境変数は `index.ts` の末尾でだけ読む。`createApp` はオプションで受け取り、テストから注入できるようにする
- 新しいエンドポイントには `src/index.test.ts` にテストを追加する (`app.request()` を使い、サーバーは起動しない)
