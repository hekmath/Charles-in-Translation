import { db } from '@/db/drizzle';
import {
  projects,
  translationTasks,
  translations,
  translationChunks,
} from '@/db/schema';
import {
  type TranslationTask,
  type Translation,
  type NewProject,
  type NewTranslationTask,
  type NewTranslation,
  type ChunkStatus,
  type TranslationProgressDetail,
} from '@/db/types';
import { eq, and, or, desc, asc, count, sql, inArray } from 'drizzle-orm';

// Projects Service with fixed delete method
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
    try {
      // First, get all translation task IDs for this project
      const projectTasks = await db
        .select({ id: translationTasks.id })
        .from(translationTasks)
        .where(eq(translationTasks.projectId, id));

      const taskIds = projectTasks.map((task) => task.id);

      // Delete in proper order to respect foreign key constraints
      if (taskIds.length > 0) {
        // Delete translation chunks for all tasks in this project
        await db
          .delete(translationChunks)
          .where(inArray(translationChunks.taskId, taskIds));
      }

      // Delete translations for this project
      await db.delete(translations).where(eq(translations.projectId, id));

      // Delete translation tasks for this project
      await db
        .delete(translationTasks)
        .where(eq(translationTasks.projectId, id));

      // Finally, delete the project itself
      const [deletedProject] = await db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

      return deletedProject;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error(
        `Failed to delete project: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
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
  static async getProgress(
    taskId: number
  ): Promise<TranslationProgressDetail | null> {
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
      context: task.context ?? undefined,
      error: task.error ?? undefined,
      chunks: chunks.map((chunk) => ({
        index: chunk.chunkIndex,
        status: chunk.status,
        itemsCount: chunk.itemsCount ?? 0,
        translatedCount: chunk.translatedCount ?? 0,
        error: chunk.errorMessage ?? undefined,
      })),
      startedAt: task.startedAt ?? undefined,
      completedAt: task.completedAt ?? undefined,
    } satisfies TranslationProgressDetail;
  }

  // Get progress for a specific project/language combination
  static async getProjectProgress(
    projectId: number,
    targetLanguage: string
  ): Promise<TranslationProgressDetail | null> {
    // First, try to find an active task (processing or pending)
    const [activeTask] = await db
      .select()
      .from(translationTasks)
      .where(
        and(
          eq(translationTasks.projectId, projectId),
          eq(translationTasks.targetLanguage, targetLanguage),
          or(
            eq(translationTasks.status, 'processing'),
            eq(translationTasks.status, 'pending')
          )
        )
      )
      .orderBy(desc(translationTasks.createdAt))
      .limit(1);

    if (activeTask) {
      return await this.getProgress(activeTask.id);
    }

    // If no active task, get the most recent task (completed or failed)
    const [recentTask] = await db
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

    if (!recentTask) return null;

    return await this.getProgress(recentTask.id);
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
    const updates: {
      status: ChunkStatus;
      updatedAt: Date;
      itemsCount?: number;
      translatedCount?: number;
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
    } = {
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
    // Use upsert with ON CONFLICT to avoid race conditions
    const [result] = await db
      .insert(translations)
      .values({
        ...data,
        translatedAt: new Date(),
        translatedBy: 'gpt-5',
        failed: data.failed || false,
      })
      .onConflictDoUpdate({
        target: [
          translations.projectId,
          translations.key,
          translations.sourceLanguage,
          translations.targetLanguage,
        ],
        set: {
          translatedText: data.translatedText,
          translatedAt: new Date(),
          taskId: data.taskId,
          chunkIndex: data.chunkIndex,
          failed: data.failed || false,
          sourceText: data.sourceText,
        },
      })
      .returning();

    return result;
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

  static async getByKeys(
    projectId: number,
    targetLanguage: string,
    keys: string[]
  ) {
    if (!keys.length) {
      return [] as Translation[];
    }

    return await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.projectId, projectId),
          eq(translations.targetLanguage, targetLanguage),
          inArray(translations.key, keys)
        )
      );
  }

  static async getProjectIdsWithLanguage(
    sourceLanguage: string,
    targetLanguage: string
  ) {
    const rows = await db
      .select({ projectId: translations.projectId })
      .from(translations)
      .where(
        and(
          eq(translations.sourceLanguage, sourceLanguage),
          eq(translations.targetLanguage, targetLanguage),
          eq(translations.failed, false)
        )
      )
      .groupBy(translations.projectId)
      .orderBy(asc(translations.projectId));

    return rows.map((row) => row.projectId);
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
