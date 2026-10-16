'use client';

import { createTodoInputSchema } from '@repo/shared';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { API_URL } from '@/lib/api';

// クライアントコンポーネント: ブラウザで動く (入力・送信などの対話部分)。
export function TodoForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // サーバーと同じスキーマで、送信前にブラウザ側でも検証する (即時にエラーを表示できる)。
    const parsed = createTodoInputSchema.safeParse({ title });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '入力が正しくありません');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
    } catch {
      setError('追加に失敗しました。API が起動しているか確認してください。');
      return;
    }

    setTitle('');
    // サーバーコンポーネント (一覧) を再取得して画面を更新する。
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="やること"
          aria-label="Todo のタイトル"
          className="flex-1 rounded border border-zinc-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          追加
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
