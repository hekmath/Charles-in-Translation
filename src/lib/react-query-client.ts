import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long to cache data before refetching
      staleTime: 1000 * 60 * 5, // 5 minutes

      // How long to keep data in cache when component unmounts
      gcTime: 1000 * 60 * 10, // 10 minutes (was cacheTime in older versions)

      // Retry failed requests
      retry: 3,

      // Retry delay that increases exponentially
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus
      refetchOnWindowFocus: false,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Default error handling
      throwOnError: false,
    },
    mutations: {
      // Retry failed mutations
      retry: 1,

      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

// Query Keys - Centralized key management
export const queryKeys = {
  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.projects.details(), id] as const,
  },

  // Translation Tasks
  translationTasks: {
    all: ['translationTasks'] as const,
    lists: () => [...queryKeys.translationTasks.all, 'list'] as const,
    list: (projectId: number) =>
      [...queryKeys.translationTasks.lists(), { projectId }] as const,
    details: () => [...queryKeys.translationTasks.all, 'detail'] as const,
    detail: (id: number) =>
      [...queryKeys.translationTasks.details(), id] as const,
  },

  // Translation Progress (with polling)
  translationProgress: {
    all: ['translationProgress'] as const,
    detail: (projectId: number, targetLanguage: string) =>
      [
        ...queryKeys.translationProgress.all,
        { projectId, targetLanguage },
      ] as const,
  },

  // Cached Translations
  translations: {
    all: ['translations'] as const,
    lists: () => [...queryKeys.translations.all, 'list'] as const,
    list: (projectId: number, targetLanguage: string) =>
      [
        ...queryKeys.translations.lists(),
        { projectId, targetLanguage },
      ] as const,
  },
} as const;

// Query key factory for easy invalidation
export const createQueryKey = (
  entity: string,
  id?: number | string,
  params?: Record<string, unknown>
) => {
  const base: (string | number | Record<string, unknown>)[] = [entity];
  if (id) base.push(id);
  if (params) base.push(params);
  return base;
};
