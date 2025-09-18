// File location: src/hooks/use-translation-state.ts

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/react-query-client';
import {
  useTranslationTasks,
  useCreateTranslationTask,
  useCachedTranslations,
  useTranslationProgress,
  useTranslate,
} from '@/lib/hooks/use-api';
import { rebuildTranslatedData } from '@/lib/translation-helpers';

interface UseTranslationStateProps {
  currentProjectId: number | null;
  targetLanguage: string;
  sourceLanguage: string;
  jsonData: Record<string, any> | null;
}

export function useTranslationState({
  currentProjectId,
  targetLanguage,
  sourceLanguage,
  jsonData,
}: UseTranslationStateProps) {
  // Local state
  const [translatedData, setTranslatedData] = useState<Record<
    string,
    any
  > | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  // Track active translation to prevent false completion notifications
  const activeTranslationRef = useRef<{
    taskId?: number;
    targetLanguage?: string;
  } | null>(null);

  // React Query hooks
  const { data: translationTasks = [] } = useTranslationTasks(currentProjectId);
  const { data: cachedTranslations = [] } = useCachedTranslations(
    currentProjectId,
    targetLanguage || null
  );

  // Enhanced translation progress with better polling
  const { data: translationProgress } = useTranslationProgress(
    currentProjectId,
    targetLanguage || null,
    showProgress && isTranslating
  );

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
    (translations: any[], data: Record<string, any>) => {
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
  const handleCompletion = useCallback((taskId: number, task: any) => {
    console.log('Completed task found after cache refresh!', task);

    // Only replace translatedData for full translations (many keys)
    // For single key retranslations, let cache restoration handle the update
    if (task.keys && task.keys.length > 1) {
      setTranslatedData(task.translatedData);
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
  }, []);

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
    if (!translationProgress || !isTranslating) return;

    if (translationProgress.status === 'completed') {
      console.log('Translation completed! Refreshing data...');

      // Add a small delay to ensure all translations are committed to database
      // This fixes the race condition where completion fires before all individual
      // translation records are fully saved
      setTimeout(() => {
        // Force refresh both translation tasks AND cached translations (Bug 2 fix)
        if (currentProjectId && targetLanguage) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.translationTasks.list(currentProjectId),
          });
          // Also invalidate cached translations to trigger UI update
          queryClient.invalidateQueries({
            queryKey: queryKeys.translations.list(
              currentProjectId,
              targetLanguage
            ),
          });
        }
      }, 1000); // 1 second delay to ensure DB consistency
    }

    if (translationProgress.status === 'failed') {
      console.log('Translation failed:', translationProgress.error);
      setIsTranslating(false);
      setShowProgress(false);
      activeTranslationRef.current = null;
      toast.error(
        `Translation failed: ${translationProgress.error || 'Unknown error'}`
      );
    }
  }, [
    translationProgress?.status,
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
    // Removed translatedData from dependencies to prevent infinite loops
  ]);

  // Handle translation with useCallback to prevent unnecessary re-renders
  const handleTranslation = useCallback(
    async (keys?: string[]) => {
      if (!jsonData || !targetLanguage || !currentProjectId) return;

      setIsTranslating(true);

      try {
        // Create translation task
        const task = await createTranslationTaskMutation.mutateAsync({
          projectId: currentProjectId,
          targetLanguage,
          keys: keys || selectedKeys || [],
        });

        // Call translate API (now uses new coordinator workflow)
        translateMutation.mutateAsync({
          data: jsonData,
          projectId: currentProjectId,
          sourceLanguage,
          targetLanguage,
          selectedKeys: keys || selectedKeys,
          taskId: task.id,
        });

        // Set up progress tracking for the new coordinator workflow
        activeTranslationRef.current = {
          taskId: task.id,
          targetLanguage,
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
      translationProgress,

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
      translationProgress,
      handleTranslation,
      resetTranslationState,
      createTranslationTaskMutation.isPending,
    ]
  );

  return returnValue;
}
