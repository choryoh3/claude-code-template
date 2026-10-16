import { zValidator } from '@hono/zod-validator';
import { createTodoInputSchema, updateTodoInputSchema } from '@repo/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { createDbStore, createMemoryStore, type TodoStore } from './store.js';

interface AppOptions {
  // ブラウザからの呼び出しを許可するフロントエンドのオリジン (CORS)
  corsOrigin?: string;
  store?: TodoStore;
}

// DB に渡す前に弾く (uuid 以外を渡すと Postgres 側で 500 になるため)。
const idParamSchema = z.object({ id: z.uuid() });

// アプリを「作る関数」にしておくと、テストごとに独立したインスタンスを作れる。
export function createApp(options: AppOptions = {}) {
  const store = options.store ?? createMemoryStore();

  const app = new Hono();

  if (process.env.NODE_ENV !== 'test') app.use(logger());

  // フロントとは別ドメインになるので、CORS で明示的に許可する。
  app.use('/api/*', cors({ origin: options.corsOrigin ?? 'http://localhost:3000' }));

  // メソッドチェーンで書くと、ルートの型が保たれる (将来 hono/client で型安全に呼べる)。
  return app
    .get('/health', (c) => c.json({ status: 'ok' as const }))
    .get('/api/todos', async (c) => c.json(await store.list()))
    .post('/api/todos', zValidator('json', createTodoInputSchema), async (c) => {
      // 入力は共有スキーマで検証済み。不正なら 400 が自動で返る。
      const { title } = c.req.valid('json');
      return c.json(await store.create(title), 201);
    })
    .patch(
      '/api/todos/:id',
      zValidator('param', idParamSchema),
      zValidator('json', updateTodoInputSchema),
      async (c) => {
        const todo = await store.update(c.req.valid('param').id, c.req.valid('json').done);
        return todo ? c.json(todo) : c.json({ error: 'Not Found' }, 404);
      },
    )
    .delete('/api/todos/:id', zValidator('param', idParamSchema), async (c) => {
      const removed = await store.remove(c.req.valid('param').id);
      return removed ? c.body(null, 204) : c.json({ error: 'Not Found' }, 404);
    });
}

export type AppType = ReturnType<typeof createApp>;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && process.env.NODE_ENV !== 'test') {
  console.warn('DATABASE_URL が未設定のため、メモリ上に保存します (再起動で消えます)');
}

// Vercel はこのファイルの default export を Vercel Function として実行する (設定不要)。
const app = createApp({
  corsOrigin: process.env.WEB_ORIGIN,
  store: databaseUrl ? createDbStore(databaseUrl) : undefined,
});

export default app;
