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
  const [translatedData, setTranslatedData] = useState<JsonObject | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  const activeTranslationRef = useRef<{
    taskId?: number;
    targetLanguage?: string;
    context?: string;
  } | null>(null);
  const previousProjectIdRef = useRef<number | null>(null);

  const { data: translationTasks = [] } = useTranslationTasks(currentProjectId);
  const { data: cachedTranslations = [] } = useCachedTranslations(
    currentProjectId,
    targetLanguage || null
  );

  const currentTaskId = activeTranslationRef.current?.taskId || null;
  const { data: translationProgress } = useTaskProgress(
    currentTaskId,
    showProgress && isTranslating && !!currentTaskId
  );

  const { data: fallbackProgress } = useTranslationProgress(
    currentProjectId,
    targetLanguage || null,
    showProgress && isTranslating && !currentTaskId
  );

  const effectiveProgress = translationProgress || fallbackProgress;

  const createTranslationTaskMutation = useCreateTranslationTask();
  const translateMutation = useTranslate();

  const queryClient = useQueryClient();

  const resetTranslationState = useCallback(() => {
    setTranslatedData(null);
    setSelectedKeys([]);
    setShowProgress(false);
    setIsTranslating(false);
    activeTranslationRef.current = null;
  }, []);

  useEffect(() => {
    if (
      previousProjectIdRef.current !== null &&
      previousProjectIdRef.current !== currentProjectId
    ) {
      resetTranslationState();
    }

    previousProjectIdRef.current = currentProjectId;
  }, [currentProjectId, resetTranslationState]);

  const restoreFromCache = useCallback(
    (
      translations: Array<{ key: string; translatedText: string }>,
      data: JsonObject
    ) => {
      try {
        const translatedResult = rebuildTranslatedData(translations, data);
        if (translatedResult) {
          setTranslatedData(translatedResult);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Failed to restore translation from cache:', error);
        toast.error(
          'Failed to restore cached translation. Please try translating again.'
        );
        return false;
      }
    },
    []
  );

  const handleCompletion = useCallback(
    (taskId: number, task: TranslationTask) => {
      setTranslatedData(task.translatedData as JsonObject | null);

      if (task.keys && task.keys.length > 1) {
        toast.success('Translation completed!');
      } else if (task.keys && task.keys.length === 1) {
        toast.success('Translation completed for selected key!');
      } else {
        toast.success('Translation completed!');
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
      activeTranslationRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (targetLanguage) {
      setTranslatedData(null);
    }
  }, [targetLanguage]);

  useEffect(() => {
    if (!effectiveProgress || !isTranslating) return;

    if (effectiveProgress.status === 'completed') {
      const refreshData = async () => {
        if (currentProjectId && targetLanguage) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.translationTasks.list(currentProjectId),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.translations.list(
              currentProjectId,
              targetLanguage
            ),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.translationProgress.detail(currentProjectId, targetLanguage),
          });
        }
      };

      setTimeout(refreshData, 500);

      setTimeout(refreshData, 2000);
    }

    if (effectiveProgress.status === 'failed') {
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

  useEffect(() => {
    if (
      !isTranslating ||
      !activeTranslationRef.current ||
      !translationTasks?.length
    )
      return;

    const { taskId } = activeTranslationRef.current;

    if (!taskId) return;

    const completedTask = translationTasks.find(
      (task) =>
        task.id === taskId && task.status === 'completed' && task.translatedData
    );

    if (completedTask) {
      handleCompletion(taskId, completedTask);
    }
  }, [translationTasks, isTranslating, handleCompletion]);

  useEffect(() => {
    if (isTranslating || translatedData) return;

    if (!cachedTranslations?.length || !jsonData || !targetLanguage) return;

    const activeTask = translationTasks?.find(
      (task) =>
        task.targetLanguage === targetLanguage &&
        (task.status === 'processing' || task.status === 'pending')
    );

    if (activeTask) {
      setIsTranslating(true);
      setShowProgress(true);
      activeTranslationRef.current = {
        taskId: activeTask.id,
        targetLanguage: activeTask.targetLanguage,
      };
      return;
    }

    try {
      restoreFromCache(cachedTranslations, jsonData);
    } catch (error) {
      console.error('Unexpected error in cache restoration effect:', error);
      toast.error('An unexpected error occurred while loading cached translations');
    }
  }, [
    cachedTranslations,
    translationTasks,
    jsonData,
    isTranslating,
    targetLanguage,
    restoreFromCache,
    translatedData,
  ]);

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
        const task = await createTranslationTaskMutation.mutateAsync({
          projectId: currentProjectId,
          targetLanguage,
          keys: keys || selectedKeys || [],
          context,
        });

        await translateMutation.mutateAsync({
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

  const returnValue = useMemo(
    () => ({
      translatedData,
      setTranslatedData,
      isTranslating,
      selectedKeys,
      setSelectedKeys,
      showProgress,
      translationProgress: effectiveProgress,

      handleTranslation,
      resetTranslationState,

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
