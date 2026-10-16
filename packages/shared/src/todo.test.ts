import { describe, expect, it } from 'vitest';
import { createTodoInputSchema, todoSchema } from './todo.js';

describe('createTodoInputSchema', () => {
  it('前後の空白を除いたタイトルを受け付ける', () => {
    expect(createTodoInputSchema.parse({ title: '  牛乳を買う  ' })).toEqual({
      title: '牛乳を買う',
    });
  });

  it('空のタイトルは拒否する', () => {
    expect(createTodoInputSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('101文字以上のタイトルは拒否する', () => {
    expect(createTodoInputSchema.safeParse({ title: 'a'.repeat(101) }).success).toBe(false);
  });
});

describe('todoSchema', () => {
  it('正しい形のデータを受け付ける', () => {
    const todo = {
      id: crypto.randomUUID(),
      title: 'テスト',
      done: false,
      createdAt: new Date().toISOString(),
    };
    expect(todoSchema.parse(todo)).toEqual(todo);
  });
});
