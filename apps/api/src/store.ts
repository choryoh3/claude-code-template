import { createDb, desc, eq, todos } from '@repo/db';
import type { Todo } from '@repo/shared';

// 保存先の差し替え口。本番は Neon、テストと DATABASE_URL 未設定のローカル開発はメモリを使う。
export interface TodoStore {
  list(): Promise<Todo[]>;
  create(title: string): Promise<Todo>;
  update(id: string, done: boolean): Promise<Todo | undefined>;
  remove(id: string): Promise<boolean>;
}

export function createMemoryStore(): TodoStore {
  const items: Todo[] = [];
  return {
    async list() {
      return [...items];
    },
    async create(title) {
      const todo: Todo = {
        id: crypto.randomUUID(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
      };
      items.unshift(todo);
      return todo;
    },
    async update(id, done) {
      const todo = items.find((t) => t.id === id);
      if (todo) todo.done = done;
      return todo;
    },
    async remove(id) {
      const index = items.findIndex((t) => t.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      return true;
    },
  };
}

const toTodo = (row: typeof todos.$inferSelect): Todo => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

export function createDbStore(databaseUrl: string): TodoStore {
  const db = createDb(databaseUrl);
  return {
    async list() {
      const rows = await db.select().from(todos).orderBy(desc(todos.createdAt));
      return rows.map(toTodo);
    },
    async create(title) {
      const [row] = await db.insert(todos).values({ title }).returning();
      return toTodo(row!);
    },
    async update(id, done) {
      const [row] = await db.update(todos).set({ done }).where(eq(todos.id, id)).returning();
      return row && toTodo(row);
    },
    async remove(id) {
      const rows = await db.delete(todos).where(eq(todos.id, id)).returning({ id: todos.id });
      return rows.length > 0;
    },
  };
}
