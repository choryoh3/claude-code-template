import { Suspense } from 'react';
import { TodoForm } from './todo-form';
import { TodoList } from './todo-list';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Todo</h1>
      <TodoForm />

      {/* cacheComponents では、キャッシュしないデータ取得 (API 呼び出し) を Suspense の内側に置く。
          外側の見出しやフォームは静的な殻として即座に表示され、一覧だけ後から流れ込む。 */}
      <Suspense fallback={<p className="text-zinc-500">読み込み中...</p>}>
        <TodoList />
      </Suspense>
    </main>
  );
}
