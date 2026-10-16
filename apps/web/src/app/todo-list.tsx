import { fetchTodos } from '@/lib/api';
import { TodoItem } from './todo-item';

// サーバーコンポーネント: サーバー側で API を呼び、HTML として描画する。
export async function TodoList() {
  let todos;
  try {
    todos = await fetchTodos();
  } catch {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
        API に接続できません。apps/api が起動しているか確認してください。
      </p>
    );
  }

  if (todos.length === 0) {
    return <p className="text-zinc-500">まだ Todo がありません。</p>;
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded border border-zinc-200">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
