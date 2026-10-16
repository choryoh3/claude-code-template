import { serve } from '@hono/node-server';
import app from './index.js';

// ローカル開発専用の起動ファイル。Vercel では使われず、index.ts の default export が使われる。
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API: http://localhost:${info.port}`);
});
