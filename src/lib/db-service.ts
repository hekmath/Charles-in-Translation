import { db } from '@/db/drizzle';
import {
  projects,
  translationTasks,
  translations,
  translationChunks,
} from '@/db/schema';
import {
  type TranslationTask,
  type NewProject,
  type NewTranslationTask,
  type NewTranslation,
  type ChunkStatus,
} from '@/db/types';
import { eq, and, desc, asc, sum, count, sql } from 'drizzle-orm';

// Projects Service (unchanged)
export class ProjectsService {
  static async create(data: Omit<NewProject, 'createdAt' | 'updatedAt'>) {
    const [project] = await db
      .insert(projects)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return project;
  }

  static async getAll() {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  static async getById(id: number) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    return project || null;
  }

  static async delete(id: number) {
    // Delete in order: chunks -> translations -> tasks -> project
    await db
      .delete(translationChunks)
      .where(
        eq(
          translationChunks.taskId,
          db
            .select({ id: translationTasks.id })
            .from(translationTasks)
            .where(eq(translationTasks.projectId, id))
        )
      );

    await db.delete(translations).where(eq(translations.projectId, id));
    await db.delete(translationTasks).where(eq(translationTasks.projectId, id));

    const [deletedProject] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    return deletedProject;
  }
}

// Translation Tasks Service with enhanced progress tracking
export class TranslationTasksService {
  static async create(
    data: Omit<NewTranslationTask, 'createdAt' | 'updatedAt' | 'status'>
  ) {
    const [task] = await db
      .insert(translationTasks)
      .values({
        ...data,
        status: 'pending',
        totalKeys: 0,
        translatedKeys: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return task;
  }

  static async update(
    id: number,
    updates: Partial<
      Pick<
        TranslationTask,
        'status' | 'translatedData' | 'error' | 'startedAt' | 'completedAt'
      >
    >
  ) {
    const [updatedTask] = await db
      .update(translationTasks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(translationTasks.id, id))
      .returning();

    return updatedTask;
  }

  // Initialize task with total keys count
  static async initializeProgress(
    id: number,
    totalKeys: number,
    totalChunks: number
  ) {
    const [updatedTask] = await db
      .update(translationTasks)
      .set({
        totalKeys,
        totalChunks,
        translatedKeys: 0,
        completedChunks: 0,
        failedChunks: 0,
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(translationTasks.id, id))
      .returning();

    return updatedTask;
  }

  // Update translated keys count (called when individual translations are saved)
  static async updateTranslatedKeys(id: number, increment: number = 1) {
    const [updatedTask] = await db
      .update(translationTasks)
      .set({
        translatedKeys: sql`translated_keys + ${increment}`,
        updatedAt: new Date(),
      })
      .where(eq(translationTasks.id, id))
      .returning();

    return updatedTask;
  }

  // Increment completed chunks
  static async incrementCompletedChunks(id: number) {
    const [updatedTask] = await db
      .update(translationTasks)
      .set({
        completedChunks: sql`completed_chunks + 1`,
        updatedAt: new Date(),
      })
      .where(eq(translationTasks.id, id))
      .returning();

    return updatedTask;
  }

  // Increment failed chunks
  static async incrementFailedChunks(id: number) {
    const [updatedTask] = await db
      .update(translationTasks)
      .set({
        failedChunks: sql`failed_chunks + 1`,
        updatedAt: new Date(),
      })
      .where(eq(translationTasks.id, id))
      .returning();

    return updatedTask;
  }

  static async getById(id: number) {
    const [task] = await db
      .select()
      .from(translationTasks)
      .where(eq(translationTasks.id, id));

    return task || null;
  }

  static async getByProject(projectId: number) {
    return await db
      .select()
      .from(translationTasks)
      .where(eq(translationTasks.projectId, projectId))
      .orderBy(desc(translationTasks.createdAt));
  }

  // Get enhanced progress with chunk details
  static async getProgress(taskId: number) {
    const [task] = await db
      .select()
      .from(translationTasks)
      .where(eq(translationTasks.id, taskId));

    if (!task) return null;

    // Get chunk breakdown
    const chunks = await db
      .select()
      .from(translationChunks)
      .where(eq(translationChunks.taskId, taskId))
      .orderBy(asc(translationChunks.chunkIndex));

    // Calculate real-time progress
    const progressPercentage =
      task.totalKeys > 0
        ? Math.round((task.translatedKeys / task.totalKeys) * 100)
        : 0;

    // Calculate estimated time remaining
    let estimatedTimeRemaining = null;
    if (task.translatedKeys > 0 && task.startedAt) {
      const elapsedMs = Date.now() - new Date(task.startedAt).getTime();
      const msPerKey = elapsedMs / task.translatedKeys;
      const remainingKeys = task.totalKeys - task.translatedKeys;
      estimatedTimeRemaining = Math.round(msPerKey * remainingKeys);
    }

    return {
      taskId: task.id,
      status: task.status,
      totalKeys: task.totalKeys,
      translatedKeys: task.translatedKeys,
      progressPercentage,
      totalChunks: task.totalChunks || 0,
      completedChunks: task.completedChunks || 0,
      failedChunks: task.failedChunks || 0,
      estimatedTimeRemaining,
      error: task.error,
      chunks: chunks.map((chunk) => ({
        index: chunk.chunkIndex,
        status: chunk.status,
        itemsCount: chunk.itemsCount,
        translatedCount: chunk.translatedCount,
        error: chunk.errorMessage,
      })),
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };
  }

  // Get progress for a specific project/language combination
  static async getProjectProgress(projectId: number, targetLanguage: string) {
    const [task] = await db
      .select()
      .from(translationTasks)
      .where(
        and(
          eq(translationTasks.projectId, projectId),
          eq(translationTasks.targetLanguage, targetLanguage)
        )
      )
      .orderBy(desc(translationTasks.createdAt))
      .limit(1);

    if (!task) return null;

    return await this.getProgress(task.id);
  }
}

// Translation Chunks Service - New service for chunk tracking
export class TranslationChunksService {
  static async initializeChunks(taskId: number, chunkCount: number) {
    const chunks = Array.from({ length: chunkCount }, (_, index) => ({
      taskId,
      chunkIndex: index,
      status: 'pending' as ChunkStatus,
      itemsCount: 0, // Will be updated when chunk is processed
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return await db.insert(translationChunks).values(chunks).returning();
  }

  static async updateStatus(
    taskId: number,
    chunkIndex: number,
    status: ChunkStatus,
    itemsCount?: number,
    translatedCount?: number,
    errorMessage?: string
  ) {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    if (itemsCount !== undefined) {
      updates.itemsCount = itemsCount;
    }

    if (translatedCount !== undefined) {
      updates.translatedCount = translatedCount;
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (status === 'processing') {
      updates.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    const [updated] = await db
      .update(translationChunks)
      .set(updates)
      .where(
        and(
          eq(translationChunks.taskId, taskId),
          eq(translationChunks.chunkIndex, chunkIndex)
        )
      )
      .returning();

    return updated;
  }

  static async getByTask(taskId: number) {
    return await db
      .select()
      .from(translationChunks)
      .where(eq(translationChunks.taskId, taskId))
      .orderBy(asc(translationChunks.chunkIndex));
  }

  static async getChunkProgress(taskId: number) {
    const chunks = await this.getByTask(taskId);

    const pending = chunks.filter((c) => c.status === 'pending').length;
    const processing = chunks.filter((c) => c.status === 'processing').length;
    const completed = chunks.filter((c) => c.status === 'completed').length;
    const failed = chunks.filter((c) => c.status === 'failed').length;

    return {
      total: chunks.length,
      pending,
      processing,
      completed,
      failed,
      chunks,
    };
  }
}

// Enhanced Translations Service
export class TranslationsService {
  static async save(
    data: Omit<NewTranslation, 'translatedAt' | 'translatedBy'> & {
      taskId?: number;
      chunkIndex?: number;
      failed?: boolean;
    }
  ) {
    // Check if translation already exists
    const [existing] = await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.key, data.key),
          eq(translations.sourceLanguage, data.sourceLanguage),
          eq(translations.targetLanguage, data.targetLanguage),
          eq(translations.projectId, data.projectId)
        )
      );

    if (existing) {
      // Update existing translation
      const [updated] = await db
        .update(translations)
        .set({
          translatedText: data.translatedText,
          translatedAt: new Date(),
          taskId: data.taskId,
          chunkIndex: data.chunkIndex,
          failed: data.failed || false,
        })
        .where(eq(translations.id, existing.id))
        .returning();

      return updated;
    } else {
      // Create new translation
      const [newTranslation] = await db
        .insert(translations)
        .values({
          ...data,
          translatedAt: new Date(),
          translatedBy: 'gpt-4o-mini',
          failed: data.failed || false,
        })
        .returning();

      return newTranslation;
    }
  }

  static async getCached(projectId: number, targetLanguage: string) {
    return await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.projectId, projectId),
          eq(translations.targetLanguage, targetLanguage),
          eq(translations.failed, false) // Only return successful translations
        )
      );
  }

  static async getByTask(taskId: number) {
    return await db
      .select()
      .from(translations)
      .where(eq(translations.taskId, taskId));
  }

  // Get translation statistics for a project
  static async getProjectStats(projectId: number, targetLanguage: string) {
    const result = await db
      .select({
        total: count(),
        successful: count(eq(translations.failed, false)),
        failed: count(eq(translations.failed, true)),
      })
      .from(translations)
      .where(
        and(
          eq(translations.projectId, projectId),
          eq(translations.targetLanguage, targetLanguage)
        )
      );

    return result[0] || { total: 0, successful: 0, failed: 0 };
  }
}

// Export enhanced services
export const dbService = {
  projects: ProjectsService,
  translationTasks: TranslationTasksService,
  translationChunks: TranslationChunksService,
  translations: TranslationsService,
};
