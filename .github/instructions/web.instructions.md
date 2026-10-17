---
description: 'Use when editing the Next.js frontend (apps/web): server/client components, data fetching, forms, Tailwind.'
applyTo: 'apps/web/**'
---

# Web (Next.js 16) ルール

- 書く前に `apps/web/AGENTS.md` を読み、該当する `node_modules/next/dist/docs/` を確認する
- 既定はサーバーコンポーネント。状態やイベントが必要な部分だけ `'use client'` に切り出す
- cacheComponents 有効: キャッシュしないデータ取得は `<Suspense>` の内側に置く
- API の URL は `@/lib/api` の `API_URL` だけを使う。`NEXT_PUBLIC_*` に秘密情報を入れない
- 外部から来たデータは `@repo/shared` のスキーマで `parse` してから使う
- 更新後の再描画は `router.refresh()` を `startTransition` で包む (既存の `todo-form.tsx` と同じ形)
- 日時表示はサーバーとブラウザで一致するよう `timeZone` を明示する
- アクセシビリティ: 入力には `aria-label` かラベル、エラーには `role="alert"`
