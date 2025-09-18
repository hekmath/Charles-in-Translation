import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  projects,
  translationTasks,
  translations,
  translationChunks,
  users,
} from './schema';

// Select types (what you get from queries)
export type Project = InferSelectModel<typeof projects>;
export type TranslationTask = InferSelectModel<typeof translationTasks>;
export type Translation = InferSelectModel<typeof translations>;
export type TranslationChunk = InferSelectModel<typeof translationChunks>;
export type User = InferSelectModel<typeof users>;

// Insert types (what you need to insert)
export type NewProject = InferInsertModel<typeof projects>;
export type NewTranslationTask = InferInsertModel<typeof translationTasks>;
export type NewTranslation = InferInsertModel<typeof translations>;
export type NewTranslationChunk = InferInsertModel<typeof translationChunks>;
export type NewUser = InferInsertModel<typeof users>;

// Status types
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ChunkStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Enhanced progress tracking types
export interface TranslationProgressDetail {
  taskId: number;
  status: TaskStatus;
  totalKeys: number;
  translatedKeys: number;
  progressPercentage: number;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  estimatedTimeRemaining: number | null;
  error?: string;
  chunks: Array<{
    index: number;
    status: ChunkStatus;
    itemsCount: number;
    translatedCount: number;
    error?: string;
  }>;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ChunkProgressSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  chunks: TranslationChunk[];
}

export interface TranslationStats {
  total: number;
  successful: number;
  failed: number;
}

// API response types
export interface TranslationProgressResponse {
  success: boolean;
  data: TranslationProgressDetail | null;
  error?: string;
}

export interface ChunkData {
  key: string;
  value: string;
}

// Inngest event data types
export interface TranslationCoordinatorEventData {
  projectId: number;
  taskId: number;
  data: Record<string, any>;
  sourceLanguage: string;
  targetLanguage: string;
  selectedKeys?: string[];
}

export interface TranslationChunkEventData {
  projectId: number;
  taskId: number;
  chunkIndex: number;
  chunk: ChunkData[];
  sourceLanguage: string;
  targetLanguage: string;
  totalChunks: number;
}

export interface TranslationCompletedEventData {
  taskId: number;
  projectId: number;
  success: boolean;
  error?: string;
}
