// convex/schema.ts - Updated with progress tracking fields
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sourceLanguage: v.string(),
    originalData: v.any(), // THIS MUST BE v.any() not v.object({})
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['createdBy'])
    .index('by_created_at', ['createdAt']),

  translationTasks: defineTable({
    projectId: v.id('projects'),
    targetLanguage: v.string(),
    keys: v.array(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    translatedData: v.optional(v.any()), // THIS MUST BE v.any()
    error: v.optional(v.string()),
    batchId: v.optional(v.string()),
    // New progress tracking fields
    totalChunks: v.optional(v.number()),
    completedChunks: v.optional(v.number()),
    currentChunk: v.optional(v.number()),
    progressPercentage: v.optional(v.number()),
    estimatedTimeRemaining: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_status', ['status'])
    .index('by_batch', ['batchId']),

  translations: defineTable({
    projectId: v.id('projects'),
    key: v.string(),
    sourceText: v.string(),
    translatedText: v.string(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    translatedAt: v.number(),
    translatedBy: v.optional(v.string()),
  })
    .index('by_project_and_language', ['projectId', 'targetLanguage'])
    .index('by_key_and_languages', ['key', 'sourceLanguage', 'targetLanguage']),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    avatar: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_email', ['email']),
});
