'use client';

import type { Todo } from '@repo/shared';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { API_URL } from '@/lib/api';

export function TodoItem({ todo }: { todo: Todo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function send(init: RequestInit) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`${API_URL}/api/todos/${todo.id}`, init);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      startTransition(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || isPending;

  return (
    <li className="flex items-center gap-3 p-3">
      <input
        type="checkbox"
        checked={todo.done}
        disabled={disabled}
        onChange={(e) =>
          send({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done: e.target.checked }),
          })
        }
        aria-label={`「${todo.title}」を完了にする`}
        className="size-4"
      />
      <span className={`flex-1 ${todo.done ? 'text-zinc-400 line-through' : ''}`}>
        {todo.title}
      </span>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          失敗しました
        </span>
      )}
      {/* サーバー (Vercel は UTC) とブラウザで表示がずれないよう、タイムゾーンを固定する */}
      <time className="text-sm text-zinc-500" dateTime={todo.createdAt}>
        {new Date(todo.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
      </time>
      <button
        type="button"
        onClick={() => send({ method: 'DELETE' })}
        disabled={disabled}
        className="text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        削除
      </button>
    </li>
  );
}
