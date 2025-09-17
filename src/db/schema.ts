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

// Enums
export const taskStatusEnum = pgEnum('task_status', [
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
  originalData: json('original_data').$type<Record<string, any>>().notNull(),
  createdBy: text('created_by'), // Will be user ID later
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Translation Tasks table with progress fields
export const translationTasks = pgTable('translation_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  targetLanguage: text('target_language').notNull(),
  keys: json('keys').$type<string[]>().notNull(),
  status: taskStatusEnum('status').default('pending').notNull(),
  translatedData: json('translated_data').$type<Record<string, any>>(),
  error: text('error'),
  batchId: text('batch_id'),

  // Progress tracking fields
  totalChunks: integer('total_chunks'),
  completedChunks: integer('completed_chunks'),
  currentChunk: integer('current_chunk'),
  progressPercentage: integer('progress_percentage').default(0),
  estimatedTimeRemaining: integer('estimated_time_remaining'), // in milliseconds

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Translations table for caching individual translations
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

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  translationTasks: many(translationTasks),
  translations: many(translations),
}));

export const translationTasksRelations = relations(
  translationTasks,
  ({ one }) => ({
    project: one(projects, {
      fields: [translationTasks.projectId],
      references: [projects.id],
    }),
  })
);

export const translationsRelations = relations(translations, ({ one }) => ({
  project: one(projects, {
    fields: [translations.projectId],
    references: [projects.id],
  }),
}));
