import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/react-query-client';
import { toast } from 'sonner';
import type {
  TranslationProgressDetail,
  Translation,
} from '@/db/types';
import type { JsonObject } from '@/types/json';

// Projects Hooks (unchanged)
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: async () => {
      const response = await apiClient.projects.getAll();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch projects');
      }
      return response.data;
    },
  });
}

export function useProject(id: number | null) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id!),
    queryFn: async () => {
      const response = await apiClient.projects.getById(id!);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch project');
      }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      sourceLanguage: string;
      originalData: JsonObject;
    }) => {
      const response = await apiClient.projects.create(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create project');
      }
      return response.data;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      queryClient.setQueryData(
        queryKeys.projects.detail(newProject.id),
        newProject
      );
      toast.success('Project created successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.projects.delete(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete project');
      }
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.projects.detail(deletedId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      toast.success('Project deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });
}

// Translation Tasks Hooks
export function useTranslationTasks(projectId: number | null) {
  return useQuery({
    queryKey: queryKeys.translationTasks.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.translationTasks.getByProject(
        projectId!
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch translation tasks');
      }
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useTranslationTask(id: number | null) {
  return useQuery({
    queryKey: queryKeys.translationTasks.detail(id!),
    queryFn: async () => {
      const response = await apiClient.translationTasks.getById(id!);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch translation task');
      }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateTranslationTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      targetLanguage: string;
      keys: string[];
      context?: string;
    }) => {
      const response = await apiClient.translationTasks.create(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create translation task');
      }
      return response.data;
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(newTask.projectId),
      });
      queryClient.setQueryData(
        queryKeys.translationTasks.detail(newTask.id),
        newTask
      );
    },
    onError: (error) => {
      toast.error(`Failed to create translation task: ${error.message}`);
    },
  });
}

// Enhanced Translation Progress Hook with better polling
export function useTranslationProgress(
  projectId: number | null,
  targetLanguage: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.translationProgress.detail(projectId!, targetLanguage!),
    queryFn: async (): Promise<TranslationProgressDetail | null> => {
      const response = await apiClient.translationProgress.get(
        projectId!,
        targetLanguage!
      );
      if (!response.success) {
        return null;
      }
      return response.data as TranslationProgressDetail | null;
    },
    enabled: enabled && !!projectId && !!targetLanguage,
    // Enhanced polling logic based on status
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;

      // Poll every 2 seconds for active processing
      if (data.status === 'processing') {
        return 2000;
      }

      // Poll every 5 seconds for pending (waiting to start)
      if (data.status === 'pending') {
        return 5000;
      }

      // Continue polling for a short time after completion to catch final updates
      if (data.status === 'completed' || data.status === 'failed') {
        const lastUpdate = query.state.dataUpdatedAt;
        const timeSinceUpdate = Date.now() - lastUpdate;

        // Poll for 10 more seconds after completion to ensure we get final state
        if (timeSinceUpdate < 10000) {
          return 3000; // Poll every 3 seconds for final updates
        }
      }

      // Stop polling after grace period
      return false;
    },
    refetchIntervalInBackground: true,
    // Don't cache completed/failed results for too long
    staleTime: (query) => {
      const data = query.state.data;
      if (!data) return 5 * 60 * 1000; // 5 minutes default

      if (data.status === 'processing' || data.status === 'pending') {
        return 0; // Always fresh for active jobs
      }

      return 30 * 60 * 1000; // 30 minutes for completed jobs
    },
  });
}

// NEW: Hook to track progress by specific taskId (CRITICAL FIX)
export function useTaskProgress(
  taskId: number | null,
  enabled = true
) {
  return useQuery({
    queryKey: ['taskProgress', taskId],
    queryFn: async (): Promise<TranslationProgressDetail | null> => {
      const response = await fetch(`/api/translation-tasks/${taskId}/progress`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.success ? data.data : null;
    },
    enabled: enabled && !!taskId,
    // Enhanced polling logic based on status
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;

      // Poll every 2 seconds for active processing
      if (data.status === 'processing') {
        return 2000;
      }

      // Poll every 5 seconds for pending (waiting to start)
      if (data.status === 'pending') {
        return 5000;
      }

      // Continue polling for a short time after completion to catch final updates
      if (data.status === 'completed' || data.status === 'failed') {
        const lastUpdate = query.state.dataUpdatedAt;
        const timeSinceUpdate = Date.now() - lastUpdate;

        // Poll for 10 more seconds after completion to ensure we get final state
        if (timeSinceUpdate < 10000) {
          return 3000; // Poll every 3 seconds for final updates
        }
      }

      // Stop polling after grace period
      return false;
    },
    refetchIntervalInBackground: true,
    // Don't cache completed/failed results for too long
    staleTime: (query) => {
      const data = query.state.data;
      if (!data) return 5 * 60 * 1000; // 5 minutes default

      if (data.status === 'processing' || data.status === 'pending') {
        return 0; // Always fresh for active jobs
      }

      return 30 * 60 * 1000; // 30 minutes for completed jobs
    },
  });
}

// Cached Translations Hook with better cache management
export function useCachedTranslations(
  projectId: number | null,
  targetLanguage: string | null
) {
  return useQuery({
    queryKey: queryKeys.translations.list(projectId!, targetLanguage!),
    queryFn: async () => {
      const response = await apiClient.translations.getCached(
        projectId!,
        targetLanguage!
      );
      if (!response.success || !response.data) {
        throw new Error(
          response.error || 'Failed to fetch cached translations'
        );
      }
      return response.data;
    },
    enabled: !!projectId && !!targetLanguage,
    // Cache translations for longer since they don't change often
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Enhanced Save Translation Hook with immediate cache updates
export function useSaveTranslation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      key: string;
      sourceText: string;
      translatedText: string;
      sourceLanguage: string;
      targetLanguage: string;
    }) => {
      const response = await apiClient.translations.save(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to save translation');
      }
      return response.data;
    },
    onMutate: async (variables) => {
      // Optimistic update: immediately update the cache
      const queryKey = queryKeys.translations.list(
        variables.projectId,
        variables.targetLanguage
      );

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTranslations =
        queryClient.getQueryData<Translation[] | undefined>(queryKey);

      const createOptimisticTranslation = (): Translation => ({
        id: -Date.now(),
        projectId: variables.projectId,
        key: variables.key,
        sourceText: variables.sourceText,
        translatedText: variables.translatedText,
        sourceLanguage: variables.sourceLanguage,
        targetLanguage: variables.targetLanguage,
        taskId: null,
        chunkIndex: null,
        failed: false,
        translatedAt: new Date(),
        translatedBy: 'manual-edit',
      });

      // Optimistically update
      queryClient.setQueryData<Translation[] | undefined>(
        queryKey,
        (old) => {
          if (!old) {
            return [createOptimisticTranslation()];
          }

          const existingIndex = old.findIndex(
            (t) =>
              t.key === variables.key &&
              t.sourceLanguage === variables.sourceLanguage &&
              t.targetLanguage === variables.targetLanguage
          );

          if (existingIndex >= 0) {
            // Update existing translation
            const updated = [...old];
            updated[existingIndex] = {
              ...updated[existingIndex],
              translatedText: variables.translatedText,
              translatedAt: new Date(),
              translatedBy: 'manual-edit',
            };
            return updated;
          }

          // Add new translation
          return [...old, createOptimisticTranslation()];
        }
      );

      return { previousTranslations };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTranslations) {
        const queryKey = queryKeys.translations.list(
          variables.projectId,
          variables.targetLanguage
        );
        queryClient.setQueryData(queryKey, context.previousTranslations);
      }
      toast.error(`Failed to save translation: ${err.message}`);
    },
    onSuccess: (savedTranslation) => {
      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(savedTranslation.projectId),
      });

      // Also invalidate progress if this was a retranslation
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationProgress.detail(
          savedTranslation.projectId,
          savedTranslation.targetLanguage
        ),
      });

      toast.success('Translation updated successfully');
    },
    onSettled: (data, error, variables) => {
      // Always refetch to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: queryKeys.translations.list(
          variables.projectId,
          variables.targetLanguage
        ),
      });
    },
  });
}

// Enhanced Translation Hook with better error handling
export function useTranslate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      data: JsonObject;
      sourceLanguage: string;
      targetLanguage: string;
      selectedKeys?: string[];
      projectId: number;
      taskId: number;
      context?: string;
    }) => {
      const response = await apiClient.translate.translate(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to start translation');
      }
      return response;
    },
    onSuccess: (_, variables) => {
      // Immediately start polling for progress
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationProgress.detail(
          variables.projectId,
          variables.targetLanguage
        ),
      });

      // Invalidate translation tasks to show new task
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(variables.projectId),
      });

      toast.success('Translation started! Processing in background...');
    },
    onError: (error) => {
      toast.error(`Failed to start translation: ${error.message}`);
    },
  });
}

// Enhanced Retranslate Hook with immediate cache updates
export function useRetranslate() {
  const queryClient = useQueryClient();
  const createTaskMutation = useCreateTranslationTask();
  const translateMutation = useTranslate();

  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      sourceLanguage: string;
      targetLanguage: string;
      keys: string[];
      originalData: JsonObject;
      context?: string;
    }) => {
      // Create a new translation task for retranslation
      const task = await createTaskMutation.mutateAsync({
        projectId: data.projectId,
        targetLanguage: data.targetLanguage,
        keys: data.keys,
        context: data.context,
      });

      // Start the translation
      await translateMutation.mutateAsync({
        data: data.originalData,
        projectId: data.projectId,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        selectedKeys: data.keys,
        taskId: task.id,
        context: data.context,
      });

      return { taskId: task.id };
    },
    onSuccess: (result, variables) => {
      // Invalidate all related caches to ensure UI updates
      const queries = [
        queryKeys.translations.list(
          variables.projectId,
          variables.targetLanguage
        ),
        queryKeys.translationTasks.list(variables.projectId),
        queryKeys.translationProgress.detail(
          variables.projectId,
          variables.targetLanguage
        ),
      ];

      queries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      toast.success(`Retranslating ${variables.keys.length} item(s)...`);
    },
    onError: (error) => {
      toast.error(`Failed to start retranslation: ${error.message}`);
    },
  });
}

// Utility hook for manual cache invalidation
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateProjects: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),

    invalidateProject: (id: number) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(id),
      }),

    invalidateTranslationTasks: (projectId: number) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(projectId),
      }),

    invalidateTranslations: (projectId: number, targetLanguage: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.translations.list(projectId, targetLanguage),
      }),

    invalidateProgress: (projectId: number, targetLanguage: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationProgress.detail(
          projectId,
          targetLanguage
        ),
      }),

    // Invalidate everything related to a project
    invalidateProjectData: (projectId: number) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          // Type guard to safely access query key structure
          if (!Array.isArray(key) || key.length === 0) return false;

          return (
            // Translation tasks for this project: ['translationTasks', 'list', { projectId }]
            (key[0] === 'translationTasks' &&
              key[1] === 'list' &&
              typeof key[2] === 'object' &&
              key[2] !== null &&
              'projectId' in key[2] &&
              key[2].projectId === projectId) ||
            // Translations for this project: ['translations', 'list', { projectId, targetLanguage }]
            (key[0] === 'translations' &&
              key[1] === 'list' &&
              typeof key[2] === 'object' &&
              key[2] !== null &&
              'projectId' in key[2] &&
              key[2].projectId === projectId) ||
            // Translation progress for this project: ['translationProgress', { projectId, targetLanguage }]
            (key[0] === 'translationProgress' &&
              typeof key[1] === 'object' &&
              key[1] !== null &&
              'projectId' in key[1] &&
              key[1].projectId === projectId) ||
            // Project detail: ['projects', 'detail', projectId]
            (key[0] === 'projects' &&
              key[1] === 'detail' &&
              key[2] === projectId)
          );
        },
      });
    },

    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
