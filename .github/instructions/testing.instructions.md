---
description: 'Use when writing or fixing tests with Vitest: test cases, edge cases, acceptance criteria to tests.'
applyTo: '**/*.test.ts'
---

# テストのルール (Vitest)

- テスト名は日本語で「条件 → 期待結果」を書く (例: `不正な ID は 400 を返す`)
- 1 テスト 1 観点。正常系・境界値・異常系をそろえる
- テストごとに `createApp()` / `createMemoryStore()` で独立したインスタンスを作り、状態を共有しない
- 外部サービス (Neon など) に接続しない。差し替え口 (`store` オプション) を使う
- 実装の内部ではなく、公開された振る舞い (HTTP の入出力、スキーマの判定結果) を検証する
- テストを skip / 削除して通すことはしない
