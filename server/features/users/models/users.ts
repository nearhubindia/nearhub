import { sql } from 'drizzle-orm';
import { pgTable, text, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
  password: text('password').notNull(),
  mobile: varchar('mobile'),
  address: text('address'),
  gstin: text('gstin'),
  location: text('location'),
  avatarUrl: text('avatar_url'),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
