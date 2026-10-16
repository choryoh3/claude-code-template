import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// テーブル定義 = DB の設計図。ここを変更して `pnpm --filter @repo/db db:generate` を実行すると、
// 差分の SQL マイグレーションが drizzle/ に生成される。
// ※ Clerk 導入後に、所有者を表す user_id 列を追加する予定。
export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  done: boolean('done').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
