// File location: src/hooks/use-project-state.ts

import { useState, useEffect } from 'react';
import { useProjects, useProject, useCreateProject } from '@/lib/hooks/use-api';
import type { JsonObject } from '@/types/json';

export function useProjectState() {
  // Local state
  const [jsonData, setJsonData] = useState<JsonObject | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

  // React Query hooks
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: currentProject } = useProject(currentProjectId);

  // Mutations
  const createProjectMutation = useCreateProject();

  // Load project data when current project changes
  useEffect(() => {
    if (currentProject) {
      setJsonData(currentProject.originalData);
      setSourceLanguage(currentProject.sourceLanguage);
    } else if (currentProjectId === null) {
      // Reset project data when no project is selected (Create New Project clicked)
      setJsonData(null);
      setSourceLanguage('en');
    }
  }, [currentProject, currentProjectId]);

  // Handle file upload
  const handleFileUpload = async (data: JsonObject) => {
    try {
      const result = await createProjectMutation.mutateAsync({
        name: `Project ${new Date().toLocaleDateString()}`,
        description: `Uploaded JSON with ${
          Object.keys(data).length
        } top-level keys`,
        sourceLanguage,
        originalData: data,
      });

      setCurrentProjectId(result.id);
      setJsonData(data);
    } catch (error) {
      console.error('Failed to create project:', error);
      // Error handling is done in the mutation hook
    }
  };

  // Reset project state
  const resetProjectState = () => {
    setJsonData(null);
    setCurrentProjectId(null);
  };

  return {
    // State
    jsonData,
    setJsonData,
    sourceLanguage,
    setSourceLanguage,
    targetLanguage,
    setTargetLanguage,
    currentProjectId,
    setCurrentProjectId,
    projects,
    currentProject,
    projectsLoading,

    // Actions
    handleFileUpload,
    resetProjectState,

    // Mutation states
    isCreatingProject: createProjectMutation.isPending,
  };
}
