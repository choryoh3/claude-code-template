import { describe, expect, it } from 'vitest';
import { createApp } from './index.js';

const postTodo = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('API', () => {
  it('GET /health は ok を返す', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('最初の GET /api/todos は空配列', async () => {
    const res = await createApp().request('/api/todos');
    expect(await res.json()).toEqual([]);
  });

  it('POST した Todo が一覧に現れる (新しい順)', async () => {
    const app = createApp();
    const created = await postTodo(app, { title: '  1つ目  ' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ title: '1つ目', done: false });

    await postTodo(app, { title: '2つ目' });
    const list = (await (await app.request('/api/todos')).json()) as { title: string }[];
    expect(list.map((t) => t.title)).toEqual(['2つ目', '1つ目']);
  });

  it('不正な入力は 400 で、保存されない', async () => {
    const app = createApp();
    expect((await postTodo(app, { title: '' })).status).toBe(400);
    expect((await postTodo(app, {})).status).toBe(400);
    expect(await (await app.request('/api/todos')).json()).toEqual([]);
  });

  it('PATCH で完了状態を更新できる', async () => {
    const app = createApp();
    const { id } = (await (await postTodo(app, { title: 'a' })).json()) as { id: string };
    const res = await app.request(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: true }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, done: true });
  });

  it('DELETE で削除でき、存在しない ID は 404、不正な ID は 400', async () => {
    const app = createApp();
    const { id } = (await (await postTodo(app, { title: 'a' })).json()) as { id: string };
    expect((await app.request(`/api/todos/${id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await app.request(`/api/todos/${id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await app.request('/api/todos/not-a-uuid', { method: 'DELETE' })).status).toBe(400);
    expect(await (await app.request('/api/todos')).json()).toEqual([]);
  });

  it('CORS: 設定したオリジンを許可する', async () => {
    const app = createApp({ corsOrigin: 'https://web.example.com' });
    const res = await app.request('/api/todos', { headers: { Origin: 'https://web.example.com' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://web.example.com');
  });
});
