import { db } from '@/db/drizzle';
import { projects, translationTasks, translations } from '@/db/schema';
import {
  type Project,
  type TranslationTask,
  type Translation,
  type NewProject,
  type NewTranslationTask,
  type NewTranslation,
  type TaskStatus,
} from '@/db/types';
import { eq, and, desc, asc } from 'drizzle-orm';

// Projects Service
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
    // First delete related translation tasks
    await db.delete(translationTasks).where(eq(translationTasks.projectId, id));

    // Delete related translations
    await db.delete(translations).where(eq(translations.projectId, id));

    // Finally delete the project
    const [deletedProject] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    return deletedProject;
  }
}

// Translation Tasks Service
export class TranslationTasksService {
  static async create(
    data: Omit<NewTranslationTask, 'createdAt' | 'updatedAt' | 'status'>
  ) {
    const [task] = await db
      .insert(translationTasks)
      .values({
        ...data,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return task;
  }

  static async update(
    id: number,
    updates: Partial<
      Pick<TranslationTask, 'status' | 'translatedData' | 'error'>
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

  static async updateProgress(
    id: number,
    progress: {
      totalChunks?: number;
      completedChunks?: number;
      currentChunk?: number;
    }
  ) {
    const updates: any = {
      updatedAt: new Date(),
    };

    if (progress.totalChunks !== undefined) {
      updates.totalChunks = progress.totalChunks;
    }
    if (progress.completedChunks !== undefined) {
      updates.completedChunks = progress.completedChunks;
    }
    if (progress.currentChunk !== undefined) {
      updates.currentChunk = progress.currentChunk;
    }

    // Calculate progress percentage
    let progressPercentage = 0;
    if (
      progress.totalChunks !== undefined &&
      progress.totalChunks > 0 &&
      progress.completedChunks !== undefined
    ) {
      progressPercentage = Math.round(
        (progress.completedChunks / progress.totalChunks) * 100
      );
    } else {
      // If we don't have new values, get current values from database
      const currentTask = await this.getById(id);
      if (
        currentTask &&
        currentTask.totalChunks &&
        currentTask.totalChunks > 0
      ) {
        const completedChunks =
          progress.completedChunks !== undefined
            ? progress.completedChunks
            : currentTask.completedChunks || 0;
        progressPercentage = Math.round(
          (completedChunks / currentTask.totalChunks) * 100
        );
      }
    }

    updates.progressPercentage = progressPercentage;

    // Calculate estimated time remaining
    if (
      updates.progressPercentage < 100 &&
      progress.completedChunks !== undefined &&
      progress.completedChunks > 0
    ) {
      const task = await this.getById(id);
      if (task && task.createdAt && task.totalChunks) {
        const elapsedTime = Date.now() - new Date(task.createdAt).getTime();
        const timePerChunk = elapsedTime / progress.completedChunks;
        const remainingChunks = task.totalChunks - progress.completedChunks;
        updates.estimatedTimeRemaining = Math.round(
          timePerChunk * remainingChunks
        );
      }
    } else {
      updates.estimatedTimeRemaining = null; // Clear when completed
    }

    const [updatedTask] = await db
      .update(translationTasks)
      .set(updates)
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

  static async getProgress(projectId: number, targetLanguage: string) {
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

    return {
      taskId: task.id,
      status: task.status,
      progressPercentage: task.progressPercentage || 0,
      totalChunks: task.totalChunks || 0,
      completedChunks: task.completedChunks || 0,
      currentChunk: task.currentChunk || 0,
      estimatedTimeRemaining: task.estimatedTimeRemaining,
      error: task.error,
    };
  }
}

// Translations Service
export class TranslationsService {
  static async save(
    data: Omit<NewTranslation, 'translatedAt' | 'translatedBy'>
  ) {
    // Check if translation already exists
    const [existing] = await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.key, data.key),
          eq(translations.sourceLanguage, data.sourceLanguage),
          eq(translations.targetLanguage, data.targetLanguage)
        )
      );

    if (existing) {
      // Update existing translation
      const [updated] = await db
        .update(translations)
        .set({
          translatedText: data.translatedText,
          translatedAt: new Date(),
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
          eq(translations.targetLanguage, targetLanguage)
        )
      );
  }
}

// Export all services
export const dbService = {
  projects: ProjectsService,
  translationTasks: TranslationTasksService,
  translations: TranslationsService,
};
