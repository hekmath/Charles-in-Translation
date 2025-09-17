import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { projects, translationTasks, translations, users } from './schema';

// Select types (what you get from queries)
export type Project = InferSelectModel<typeof projects>;
export type TranslationTask = InferSelectModel<typeof translationTasks>;
export type Translation = InferSelectModel<typeof translations>;
export type User = InferSelectModel<typeof users>;

// Insert types (what you need to insert)
export type NewProject = InferInsertModel<typeof projects>;
export type NewTranslationTask = InferInsertModel<typeof translationTasks>;
export type NewTranslation = InferInsertModel<typeof translations>;
export type NewUser = InferInsertModel<typeof users>;

// Status types
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
