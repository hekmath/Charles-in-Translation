'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useProjectState } from '@/lib/hooks/use-project-state';

export type ProjectContextValue = ReturnType<typeof useProjectState>;

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const {
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
    handleFileUpload,
    resetProjectState,
    isCreatingProject,
  } = useProjectState();

  const contextValue = useMemo(
    () => ({
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
      handleFileUpload,
      resetProjectState,
      isCreatingProject,
    }),
    [
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
      handleFileUpload,
      resetProjectState,
      isCreatingProject,
    ]
  );

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
