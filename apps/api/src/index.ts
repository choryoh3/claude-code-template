import { zValidator } from '@hono/zod-validator';
import { createTodoInputSchema, type Todo } from '@repo/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

interface AppOptions {
  // ブラウザからの呼び出しを許可するフロントエンドのオリジン (CORS)
  corsOrigin?: string;
}

// アプリを「作る関数」にしておくと、テストごとに独立したインスタンスを作れる。
export function createApp(options: AppOptions = {}) {
  // TODO: Neon (@repo/db の Drizzle) に置き換える。今は動作確認用のメモリ上の保存先。
  // サーバーレス環境ではインスタンスが入れ替わるため、再起動やデプロイでデータは消える。
  const todos: Todo[] = [];

  const app = new Hono();

  if (process.env.NODE_ENV !== 'test') app.use(logger());

  // フロントとは別ドメインになるので、CORS で明示的に許可する。
  app.use('/api/*', cors({ origin: options.corsOrigin ?? 'http://localhost:3000' }));

  // メソッドチェーンで書くと、ルートの型が保たれる (将来 hono/client で型安全に呼べる)。
  return app
    .get('/health', (c) => c.json({ status: 'ok' as const }))
    .get('/api/todos', (c) => c.json(todos))
    .post('/api/todos', zValidator('json', createTodoInputSchema), (c) => {
      // 入力は共有スキーマで検証済み。不正なら 400 が自動で返る。
      const { title } = c.req.valid('json');
      const todo: Todo = {
        id: crypto.randomUUID(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
      };
      todos.unshift(todo);
      return c.json(todo, 201);
    });
}

export type AppType = ReturnType<typeof createApp>;

// Vercel はこのファイルの default export を Vercel Function として実行する (設定不要)。
const app = createApp({ corsOrigin: process.env.WEB_ORIGIN });

export default app;
