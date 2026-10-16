import { z } from 'zod';

// フロント(フォームの入力チェック)とバックエンド(APIの入力チェック)で
// 同じスキーマを使うことで、検証ルールのズレを防ぐ。これがモノレポで共有する最大の利点。

export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(100),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const createTodoInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'タイトルを入力してください')
    .max(100, '100文字以内で入力してください'),
});

// スキーマから型を生成する。型とバリデーションを二重管理しない。
export type Todo = z.infer<typeof todoSchema>;
export type CreateTodoInput = z.infer<typeof createTodoInputSchema>;
