---
name: feature-delivery
description: '要件定義 → 設計 → 並列実装 → テスト → レビュー → デプロイ準備までを、サブエージェントを並列に動かして進める手順。Use when: 新機能の開発、複数パッケージにまたがる変更、サブエージェントへの分担・並列化、タスク分割。'
argument-hint: '作りたい機能の説明'
---

# Feature Delivery (並列ハーネス)

オーケストレーター (Fullstack Mentor) がこの手順に沿ってサブエージェントを呼び出す。
**同じターンで複数のサブエージェントを呼ぶと並列に実行される。** 依存のない作業は必ず同じターンにまとめる。

## フェーズと並列化

| # | フェーズ | 呼び出すエージェント (同じ行 = 並列) | ゲート (次に進む条件) |
|---|---|---|---|
| 1 | 調査・要件 | `Requirements Analyst` ‖ `Explore` (影響範囲の調査) | ユーザーが要件と未確定事項に回答した |
| 2 | 設計 | `Architect` ‖ `Infra Engineer` (本番影響がある場合のみ) | タスク分割表の担当ファイルが重複していない |
| 3a | 契約の実装 | `Implementer` × 1 (`packages/shared` → `packages/db`) | 契約のパッケージが検証を通過 |
| 3b | 並列実装 | `Implementer` (api) ‖ `Implementer` (web) ‖ `Test Engineer` | 全員の報告が `status: done` |
| 4 | 統合検証 | オーケストレーター自身が `verify` スキルを `--build` 付きで実行 | すべて ✅ |
| 5 | レビュー | `Code Reviewer` ‖ `Test Engineer` (抜け漏れ分析) | 🔴 の指摘が 0 |
| 6 | リリース準備 | `Infra Engineer` (マイグレーション・環境変数・手順) | ユーザーが手順を了承 |

小さな変更ではフェーズを省略してよい (例: 1 ファイルの修正 → 3 → 4 → 5)。

## 並列化のルール (衝突を防ぐ)

1. **ファイルの所有権**: 並列で動く編集系エージェントには、担当ファイルを明示的に割り当てる。重なる場合は直列にする
2. **契約が先**: 共有スキーマと DB スキーマは並列実装の前に確定・実装する (3a)。並列中に契約を変えない
3. **読み取り系は自由に並列**: `Explore` / `Requirements Analyst` / `Architect` / `Code Reviewer` は何体でも並列にしてよい
4. **自己完結した指示**: サブエージェントは会話を共有しない。指示には目的・契約・担当ファイル・受け入れ条件・検証コマンドを全部書く
5. **報告の統合**: 全員の報告を受けてから次のフェーズに進む。`status: blocked` があれば、原因を解消してからそのタスクだけ再実行する
6. **リトライ上限**: 同じタスクの再実行は 2 回まで。超えたらユーザーに状況を説明して判断を仰ぐ

## サブエージェントへの指示テンプレート

```text
## 目的
<このタスクで達成すること>
## 契約
<共有スキーマ / API の入出力 / DB の列 (確定済みのもの)>
## 担当ファイル (これ以外は編集禁止)
- <path>
## 受け入れ条件
- Given ... When ... Then ...
## 検証
node .github/skills/verify/scripts/verify.cjs --filter <package>
## 報告
.github/skills/feature-delivery/references/handoff.md の形式で返す
```

## 参考資料

- [要件テンプレート](./references/requirements-template.md)
- [設計テンプレート](./references/design-template.md)
- [報告フォーマット](./references/handoff.md)
