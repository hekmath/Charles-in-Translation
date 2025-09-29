import type {
  Project,
  TranslationTask,
  Translation,
  TranslationProgressDetail,
} from '@/db/types';
import type { JsonObject } from '@/types/json';

// Base API response types
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string;
}

// Request types
interface CreateProjectRequest {
  name: string;
  description?: string;
  sourceLanguage: string;
  originalData: JsonObject;
}

interface CreateTranslationTaskRequest {
  projectId: number;
  targetLanguage: string;
  keys: string[];
  context?: string;
}

interface UpdateTranslationTaskRequest {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  translatedData?: JsonObject;
  error?: string;
}

interface UpdateProgressRequest {
  totalChunks?: number;
  completedChunks?: number;
  currentChunk?: number;
}

interface SaveTranslationRequest {
  projectId: number;
  key: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

// Base fetch wrapper with error handling
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Projects API
export const projectsApi = {
  // GET /api/projects
  getAll: () => apiRequest<Project[]>('/api/projects'),

  // GET /api/projects/[id]
  getById: (id: number) => apiRequest<Project>(`/api/projects/${id}`),

  // POST /api/projects
  create: (data: CreateProjectRequest) =>
    apiRequest<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // DELETE /api/projects/[id]
  delete: (id: number) =>
    apiRequest(`/api/projects/${id}`, {
      method: 'DELETE',
    }),
};

// Translation Tasks API
export const translationTasksApi = {
  // GET /api/translation-tasks?projectId=X
  getByProject: (projectId: number) =>
    apiRequest<TranslationTask[]>(
      `/api/translation-tasks?projectId=${projectId}`
    ),

  // GET /api/translation-tasks/[id]
  getById: (id: number) =>
    apiRequest<TranslationTask>(`/api/translation-tasks/${id}`),

  // POST /api/translation-tasks
  create: (data: CreateTranslationTaskRequest) =>
    apiRequest<TranslationTask>('/api/translation-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // PUT /api/translation-tasks/[id]
  update: (id: number, data: UpdateTranslationTaskRequest) =>
    apiRequest<TranslationTask>(`/api/translation-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // PUT /api/translation-tasks/[id]/progress
  updateProgress: (id: number, data: UpdateProgressRequest) =>
    apiRequest<TranslationTask>(`/api/translation-tasks/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Translation Progress API
export const translationProgressApi = {
  // GET /api/translation-progress?projectId=X&targetLanguage=Y
  get: (projectId: number, targetLanguage: string) =>
    apiRequest<TranslationProgressDetail | null>(
      `/api/translation-progress?projectId=${projectId}&targetLanguage=${targetLanguage}`
    ),
};

// Translations API
export const translationsApi = {
  // GET /api/translations?projectId=X&targetLanguage=Y
  getCached: (projectId: number, targetLanguage: string) =>
    apiRequest<Translation[]>(
      `/api/translations?projectId=${projectId}&targetLanguage=${targetLanguage}`
    ),

  // POST /api/translations
  save: (data: SaveTranslationRequest) =>
    apiRequest<Translation>('/api/translations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Translation API (main translation endpoint)
export const translateApi = {
  // POST /api/translate
  translate: (data: {
    data: JsonObject;
    sourceLanguage: string;
    targetLanguage: string;
    selectedKeys?: string[];
    projectId: number;
    taskId: number;
    context?: string;
  }) =>
    apiRequest('/api/translate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Convenience wrapper that combines all APIs
export const apiClient = {
  projects: projectsApi,
  translationTasks: translationTasksApi,
  translationProgress: translationProgressApi,
  translations: translationsApi,
  translate: translateApi,
};

// Helper function for handling API responses
export function handleApiResponse<T>(
  response: ApiResponse<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: string) => void
): boolean {
  if (response.success && response.data) {
    onSuccess?.(response.data);
    return true;
  } else {
    onError?.(response.error || 'Unknown error');
    return false;
  }
}
