import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/react-query-client';

import { toast } from 'sonner';

// Projects Hooks
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
    enabled: !!id, // Only run query if id exists
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      sourceLanguage: string;
      originalData: Record<string, any>;
    }) => {
      const response = await apiClient.projects.create(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create project');
      }
      return response.data;
    },
    onSuccess: (newProject) => {
      // Invalidate projects list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });

      // Optimistically add to cache
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
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.projects.detail(deletedId),
      });

      // Invalidate projects list
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
    }) => {
      const response = await apiClient.translationTasks.create(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create translation task');
      }
      return response.data;
    },
    onSuccess: (newTask) => {
      // Invalidate tasks list for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(newTask.projectId),
      });

      // Add to cache
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

export function useUpdateTranslationTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: {
        status?: 'pending' | 'processing' | 'completed' | 'failed';
        translatedData?: Record<string, any>;
        error?: string;
      };
    }) => {
      const response = await apiClient.translationTasks.update(id, updates);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update translation task');
      }
      return response.data;
    },
    onSuccess: (updatedTask) => {
      // Update the individual task cache
      queryClient.setQueryData(
        queryKeys.translationTasks.detail(updatedTask.id),
        updatedTask
      );

      // Invalidate the tasks list to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(updatedTask.projectId),
      });
    },
    onError: (error) => {
      toast.error(`Failed to update translation task: ${error.message}`);
    },
  });
}

// Translation Progress Hook (with polling for active translations)
export function useTranslationProgress(
  projectId: number | null,
  targetLanguage: string | null,
  enabled = true
) {
  type ProgressData = {
    taskId: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progressPercentage: number;
    totalChunks: number;
    completedChunks: number;
    currentChunk: number;
    estimatedTimeRemaining: number | null;
    error?: string;
  } | null;

  return useQuery<ProgressData>({
    queryKey: queryKeys.translationProgress.detail(projectId!, targetLanguage!),
    queryFn: async () => {
      const response = await apiClient.translationProgress.get(
        projectId!,
        targetLanguage!
      );
      if (!response.success) {
        return null;
      }
      return response.data as ProgressData;
    },
    enabled: enabled && !!projectId && !!targetLanguage,
    // Poll every 2 seconds if translation is in progress (v5 syntax)
    refetchInterval: (query) => {
      const data = query.state.data;
      const isProcessing = data && data.status === 'processing';
      return isProcessing ? 2000 : false;
    },
    // Keep polling in background
    refetchIntervalInBackground: true,
  });
}

// Cached Translations Hook
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
  });
}

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
    onSuccess: (savedTranslation) => {
      // Invalidate cached translations for this project and language
      queryClient.invalidateQueries({
        queryKey: queryKeys.translations.list(
          savedTranslation.projectId,
          savedTranslation.targetLanguage
        ),
      });
    },
    onError: (error) => {
      toast.error(`Failed to save translation: ${error.message}`);
    },
  });
}

// Translation Hook (main translation API)
export function useTranslate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      data: Record<string, any>;
      sourceLanguage: string;
      targetLanguage: string;
      selectedKeys?: string[];
      projectId: number;
      taskId: number;
    }) => {
      const response = await apiClient.translate.translate(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to start translation');
      }
      return response;
    },
    onSuccess: (_, variables) => {
      // Start polling for progress
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationProgress.detail(
          variables.projectId,
          variables.targetLanguage
        ),
      });

      // Also invalidate translation tasks
      queryClient.invalidateQueries({
        queryKey: queryKeys.translationTasks.list(variables.projectId),
      });
    },
    onError: (error) => {
      toast.error(`Failed to start translation: ${error.message}`);
    },
  });
}

// Utility hook for query invalidation
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

    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
