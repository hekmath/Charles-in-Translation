import {
  pgTable,
  text,
  timestamp,
  json,
  serial,
  integer,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { JsonObject } from '@/types/json';

// Enums
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const chunkStatusEnum = pgEnum('chunk_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// Projects table - matches your Convex schema
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  sourceLanguage: text('source_language').notNull(),
  originalData: json('original_data').$type<JsonObject>().notNull(),
  createdBy: text('created_by'), // Will be user ID later
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Translation Tasks table with enhanced progress fields
export const translationTasks = pgTable('translation_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  targetLanguage: text('target_language').notNull(),
  keys: json('keys').$type<string[]>().notNull(),
  status: taskStatusEnum('status').default('pending').notNull(),
  translatedData: json('translated_data').$type<JsonObject>(),
  error: text('error'),
  batchId: text('batch_id'),
  context: text('context'),

  // Enhanced progress tracking fields
  totalKeys: integer('total_keys').default(0).notNull(),
  translatedKeys: integer('translated_keys').default(0).notNull(),
  totalChunks: integer('total_chunks'),
  completedChunks: integer('completed_chunks'),
  currentChunk: integer('current_chunk'),
  failedChunks: integer('failed_chunks').default(0),
  progressPercentage: integer('progress_percentage').default(0),
  estimatedTimeRemaining: integer('estimated_time_remaining'), // in milliseconds

  // Time tracking
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// New: Translation Chunks table for granular tracking
export const translationChunks = pgTable('translation_chunks', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => translationTasks.id, { onDelete: 'cascade' })
    .notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  status: chunkStatusEnum('status').default('pending').notNull(),

  // Chunk metrics
  itemsCount: integer('items_count').notNull().default(0),
  translatedCount: integer('translated_count').notNull().default(0),

  // Error tracking
  errorMessage: text('error_message'),

  // Time tracking
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Enhanced Translations table with chunk tracking
export const translations = pgTable('translations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  key: text('key').notNull(),
  sourceText: text('source_text').notNull(),
  translatedText: text('translated_text').notNull(),
  sourceLanguage: text('source_language').notNull(),
  targetLanguage: text('target_language').notNull(),

  // Enhanced tracking
  taskId: integer('task_id').references(() => translationTasks.id),
  chunkIndex: integer('chunk_index'),
  failed: boolean('failed').default(false).notNull(),

  translatedAt: timestamp('translated_at').defaultNow().notNull(),
  translatedBy: text('translated_by').default('gpt-4o-mini'),
});

// Users table (for future auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Enhanced Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  translationTasks: many(translationTasks),
  translations: many(translations),
}));

export const translationTasksRelations = relations(
  translationTasks,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [translationTasks.projectId],
      references: [projects.id],
    }),
    chunks: many(translationChunks),
    translations: many(translations),
  })
);

export const translationChunksRelations = relations(
  translationChunks,
  ({ one }) => ({
    task: one(translationTasks, {
      fields: [translationChunks.taskId],
      references: [translationTasks.id],
    }),
  })
);

export const translationsRelations = relations(translations, ({ one }) => ({
  project: one(projects, {
    fields: [translations.projectId],
    references: [projects.id],
  }),
  task: one(translationTasks, {
    fields: [translations.taskId],
    references: [translationTasks.id],
  }),
}));
