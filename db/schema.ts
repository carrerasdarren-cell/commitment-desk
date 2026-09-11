import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Only admission counters are stored. Project notes and access codes are not.
export const judgeAllowance = sqliteTable('judge_allowance', {
  id: text('id').primaryKey(),
  used: integer('used').notNull(),
  leaseUntil: integer('lease_until').notNull(),
  leaseToken: text('lease_token').notNull(),
});
