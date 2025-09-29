// File location: src/hooks/use-translation-state.ts

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/react-query-client';
import type { TranslationTask } from '@/db/types';
import type { JsonObject } from '@/types/json';
import {
  useTranslationTasks,
  useCreateTranslationTask,
  useCachedTranslations,
  useTranslationProgress,
  useTaskProgress,
  useTranslate,
} from '@/lib/hooks/use-api';
import { rebuildTranslatedData } from '@/lib/translation-helpers';

interface UseTranslationStateProps {
  currentProjectId: number | null;
  targetLanguage: string;
  sourceLanguage: string;
  jsonData: JsonObject | null;
}

export function useTranslationState({
  currentProjectId,
  targetLanguage,
  sourceLanguage,
  jsonData,
}: UseTranslationStateProps) {
  // Local state
  const [translatedData, setTranslatedData] = useState<JsonObject | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  // Track active translation to prevent false completion notifications
  const activeTranslationRef = useRef<{
    taskId?: number;
    targetLanguage?: string;
    context?: string;
  } | null>(null);

  // React Query hooks
  const { data: translationTasks = [] } = useTranslationTasks(currentProjectId);
  const { data: cachedTranslations = [] } = useCachedTranslations(
    currentProjectId,
    targetLanguage || null
  );

  // CRITICAL FIX: Track progress by specific taskId instead of project+language
  const currentTaskId = activeTranslationRef.current?.taskId || null;
  const { data: translationProgress } = useTaskProgress(
    currentTaskId,
    showProgress && isTranslating && !!currentTaskId
  );

  // Fallback to project-level progress for legacy compatibility
  const { data: fallbackProgress } = useTranslationProgress(
    currentProjectId,
    targetLanguage || null,
    showProgress && isTranslating && !currentTaskId
  );

  // Use task-specific progress if available, otherwise fallback
  const effectiveProgress = translationProgress || fallbackProgress;

  // Mutations
  const createTranslationTaskMutation = useCreateTranslationTask();
  const translateMutation = useTranslate();

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Memoized reset function to prevent unnecessary re-renders
  const resetTranslationState = useCallback(() => {
    setTranslatedData(null);
    setSelectedKeys([]);
    setShowProgress(false);
    setIsTranslating(false);
    activeTranslationRef.current = null;
  }, []);

  // Memoized cache restoration function with error handling
  const restoreFromCache = useCallback(
    (
      translations: Array<{ key: string; translatedText: string }>,
      data: JsonObject
    ) => {
      try {
        const translatedResult = rebuildTranslatedData(translations, data);
        if (translatedResult) {
          setTranslatedData(translatedResult);
          console.log('Translation restored from cache!');
          return true;
        }
      } catch (error) {
        console.error('Failed to restore translation from cache:', error);
        // Don't crash the app, just log the error
      }
      return false;
    },
    []
  );

  // Memoized completion handler
  const handleCompletion = useCallback(
    (taskId: number, task: TranslationTask) => {
      console.log('Completed task found after cache refresh!', task);

      // Only replace translatedData for full translations (many keys)
      // For single key retranslations, let cache restoration handle the update
      if (task.keys && task.keys.length > 1) {
        setTranslatedData(task.translatedData as JsonObject | null);
        toast.success('Translation completed!');
      } else {
        // Single key retranslation - just reset state and let cache handle it
        console.log(
          'Single key retranslation completed, using cache restoration'
        );
      }

      setIsTranslating(false);
      setShowProgress(false);
      activeTranslationRef.current = null;
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up any pending operations
      activeTranslationRef.current = null;
    };
  }, []);

  // Clear translated data when target language changes (Bug 3 fix)
  // Optimized to only run when target language actually changes
  useEffect(() => {
    if (targetLanguage) {
      console.log(
        'Target language changed to:',
        targetLanguage,
        '- clearing translated data'
      );
      setTranslatedData(null);
    }
  }, [targetLanguage]);

  // Enhanced completion detection using the new progress structure
  // Optimized dependencies to prevent unnecessary re-runs
  useEffect(() => {
    if (!effectiveProgress || !isTranslating) return;

    if (effectiveProgress.status === 'completed') {
      console.log('Translation completed! Refreshing data...');

      // Add a small delay to ensure all translations are committed to database
      // This fixes the race condition where completion fires before all individual
      // translation records are fully saved
      const refreshData = async () => {
        if (currentProjectId && targetLanguage) {
          // Invalidate in sequence to ensure proper refresh
          await queryClient.invalidateQueries({
            queryKey: queryKeys.translationTasks.list(currentProjectId),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.translations.list(
              currentProjectId,
              targetLanguage
            ),
          });
          // Also invalidate progress to ensure it shows final state
          await queryClient.invalidateQueries({
            queryKey: queryKeys.translationProgress.detail(currentProjectId, targetLanguage),
          });
        }
      };

      // Initial quick refresh
      setTimeout(refreshData, 500);

      // Follow-up refresh to ensure we catch any delayed DB updates
      setTimeout(refreshData, 2000);
    }

    if (effectiveProgress.status === 'failed') {
      console.log('Translation failed:', effectiveProgress.error);
      setIsTranslating(false);
      setShowProgress(false);
      activeTranslationRef.current = null;
      toast.error(
        `Translation failed: ${effectiveProgress.error || 'Unknown error'}`
      );
    }
  }, [
    effectiveProgress,
    isTranslating,
    currentProjectId,
    targetLanguage,
    queryClient,
  ]);

  // Detect completion after cache refresh (only for full translations, not retranslations)
  // Optimized to only run when necessary
  useEffect(() => {
    if (
      !isTranslating ||
      !activeTranslationRef.current ||
      !translationTasks?.length
    )
      return;

    const { taskId } = activeTranslationRef.current;

    // Ensure taskId exists before proceeding
    if (!taskId) return;

    // Look for the completed task in the refreshed data
    const completedTask = translationTasks.find(
      (task) =>
        task.id === taskId && task.status === 'completed' && task.translatedData
    );

    if (completedTask) {
      handleCompletion(taskId, completedTask);
    }
  }, [translationTasks, isTranslating, handleCompletion]);

  // Auto-restore from cached translations (only if no active translation)
  // Fixed infinite loop by removing translatedData from dependencies
  useEffect(() => {
    // Don't run if we're translating or already have translated data
    if (isTranslating || translatedData) return;

    // Don't run if we don't have the required data
    if (!cachedTranslations?.length || !jsonData || !targetLanguage) return;

    // Check if there's an active translation task first
    const activeTask = translationTasks?.find(
      (task) =>
        task.targetLanguage === targetLanguage &&
        (task.status === 'processing' || task.status === 'pending')
    );

    if (activeTask) {
      // There's an active translation - show progress instead of cached results
      console.log(
        'Found active translation task:',
        activeTask.id,
        'Status:',
        activeTask.status
      );
      setIsTranslating(true);
      setShowProgress(true);
      activeTranslationRef.current = {
        taskId: activeTask.id,
        targetLanguage: activeTask.targetLanguage,
      };
      return;
    }

    // No active translation - safe to restore from cache
    console.log(
      'Restoring translation from cache...',
      cachedTranslations.length,
      'cached translations'
    );
    restoreFromCache(cachedTranslations, jsonData);
  }, [
    cachedTranslations,
    translationTasks,
    jsonData,
    isTranslating,
    targetLanguage,
    restoreFromCache,
    translatedData,
  ]);

  // Handle translation with useCallback to prevent unnecessary re-renders
  const handleTranslation = useCallback(
    async (
      params: {
        keys?: string[];
        context?: string;
        skipCache?: boolean;
        cacheProjectId?: number;
      } = {}
    ) => {
      const { keys, context, skipCache, cacheProjectId } = params;
      if (!jsonData || !targetLanguage || !currentProjectId) return;

      setIsTranslating(true);

      try {
        // Create translation task
        const task = await createTranslationTaskMutation.mutateAsync({
          projectId: currentProjectId,
          targetLanguage,
          keys: keys || selectedKeys || [],
          context,
        });

        // Call translate API (now uses new coordinator workflow)
        translateMutation.mutateAsync({
          data: jsonData,
          projectId: currentProjectId,
          sourceLanguage,
          targetLanguage,
          selectedKeys: keys || selectedKeys,
          taskId: task.id,
          context,
          skipCache,
          cacheProjectId,
        });

        // Set up progress tracking for the new coordinator workflow
        activeTranslationRef.current = {
          taskId: task.id,
          targetLanguage,
          context,
        };
        setShowProgress(true);

        toast.success(
          `Translation job queued! Processing in background with new workflow.`
        );
      } catch (error) {
        console.error('Translation failed:', error);
        setIsTranslating(false);
        setShowProgress(false);
        activeTranslationRef.current = null;
        // Error handling is done in the mutation hooks
      }
    },
    [
      jsonData,
      targetLanguage,
      currentProjectId,
      selectedKeys,
      sourceLanguage,
      createTranslationTaskMutation,
      translateMutation,
    ]
  );

  // Memoize return value to prevent unnecessary re-renders in consuming components
  const returnValue = useMemo(
    () => ({
      // State
      translatedData,
      setTranslatedData,
      isTranslating,
      selectedKeys,
      setSelectedKeys,
      showProgress,
      translationProgress: effectiveProgress,

      // Actions
      handleTranslation,
      resetTranslationState,

      // Mutation states
      isCreatingTask: createTranslationTaskMutation.isPending,
    }),
    [
      translatedData,
      isTranslating,
      selectedKeys,
      showProgress,
      effectiveProgress,
      handleTranslation,
      resetTranslationState,
      createTranslationTaskMutation.isPending,
    ]
  );

  return returnValue;
}
