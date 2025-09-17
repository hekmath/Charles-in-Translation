import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new translation project
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sourceLanguage: v.string(),
    originalData: v.any(), // must be v.any()
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert('projects', {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return projectId;
  },
});

// Get all projects
export const getProjects = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('projects').order('desc').collect();
  },
});

// Get a single project
export const getProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

// Create translation task
export const createTranslationTask = mutation({
  args: {
    projectId: v.id('projects'),
    targetLanguage: v.string(),
    keys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert('translationTasks', {
      ...args,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return taskId;
  },
});

// Update translation task
export const updateTranslationTask = mutation({
  args: {
    taskId: v.id('translationTasks'),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    translatedData: v.optional(v.any()), // must be v.any()
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    await ctx.db.patch(taskId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Get translation tasks for a project
export const getTranslationTasks = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('translationTasks')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect();
  },
});

// Save individual translation for caching
export const saveTranslation = mutation({
  args: {
    projectId: v.id('projects'),
    key: v.string(),
    sourceText: v.string(),
    translatedText: v.string(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('translations')
      .withIndex('by_key_and_languages', (q) =>
        q
          .eq('key', args.key)
          .eq('sourceLanguage', args.sourceLanguage)
          .eq('targetLanguage', args.targetLanguage)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        translatedText: args.translatedText,
        translatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert('translations', {
        ...args,
        translatedAt: Date.now(),
        translatedBy: 'gpt-4o-mini',
      });
    }
  },
});

// Get cached translations
export const getCachedTranslations = query({
  args: {
    projectId: v.id('projects'),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('translations')
      .withIndex('by_project_and_language', (q) =>
        q
          .eq('projectId', args.projectId)
          .eq('targetLanguage', args.targetLanguage)
      )
      .collect();
  },
});

// Delete a project and all related data
export const deleteProject = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query('translationTasks')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    const translations = await ctx.db
      .query('translations')
      .withIndex('by_project_and_language', (q) =>
        q.eq('projectId', args.projectId)
      )
      .collect();

    for (const translation of translations) {
      await ctx.db.delete(translation._id);
    }

    await ctx.db.delete(args.projectId);
  },
});

export const updateTranslationTaskProgress = mutation({
  args: {
    taskId: v.id('translationTasks'),
    totalChunks: v.optional(v.number()),
    completedChunks: v.optional(v.number()),
    currentChunk: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { taskId, totalChunks, completedChunks, currentChunk } = args;

    // Calculate progress percentage
    let progressPercentage = 0;
    let estimatedTimeRemaining = null;

    if (totalChunks && totalChunks > 0 && completedChunks !== undefined) {
      progressPercentage = Math.round((completedChunks / totalChunks) * 100);

      // Simple estimation: if we've completed some chunks, estimate remaining time
      if (completedChunks > 0) {
        const task = await ctx.db.get(taskId);
        if (task && task.createdAt) {
          const elapsedTime = Date.now() - task.createdAt;
          const timePerChunk = elapsedTime / completedChunks;
          const remainingChunks = totalChunks - completedChunks;
          estimatedTimeRemaining = Math.round(timePerChunk * remainingChunks);
        }
      }
    }

    const updates: any = {
      updatedAt: Date.now(),
      progressPercentage,
    };

    if (totalChunks !== undefined) updates.totalChunks = totalChunks;
    if (completedChunks !== undefined)
      updates.completedChunks = completedChunks;
    if (currentChunk !== undefined) updates.currentChunk = currentChunk;
    if (estimatedTimeRemaining !== null)
      updates.estimatedTimeRemaining = estimatedTimeRemaining;

    await ctx.db.patch(taskId, updates);
  },
});

export const getTranslationTaskWithProgress = query({
  args: { taskId: v.id('translationTasks') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getTranslationProgress = query({
  args: {
    projectId: v.id('projects'),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query('translationTasks')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('targetLanguage'), args.targetLanguage))
      .order('desc')
      .take(1);

    if (tasks.length === 0) return null;

    const task = tasks[0];
    return {
      taskId: task._id,
      status: task.status,
      progressPercentage: task.progressPercentage || 0,
      totalChunks: task.totalChunks || 0,
      completedChunks: task.completedChunks || 0,
      currentChunk: task.currentChunk || 0,
      estimatedTimeRemaining: task.estimatedTimeRemaining,
      error: task.error,
    };
  },
});
