import { todoSchema } from '@repo/shared';

// バックエンド API (apps/api) のベース URL。
// NEXT_PUBLIC_ 付きの環境変数はブラウザ側のコードにも埋め込まれる (= 秘密情報は入れない)。
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

// サーバーコンポーネントから呼ぶ。毎回最新を取得するためキャッシュしない。
export async function fetchTodos() {
  const res = await fetch(`${API_URL}/api/todos`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  // 外部から来たデータは型を信用せず、共有スキーマで検証してから使う。
  return todoSchema.array().parse(await res.json());
}
