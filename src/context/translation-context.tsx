'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslationState } from '@/lib/hooks/use-translation-state';
import { useProject } from '@/context/project-context';

export type TranslationContextValue = ReturnType<typeof useTranslationState>;

const TranslationContext =
  createContext<TranslationContextValue | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const { currentProjectId, targetLanguage, sourceLanguage, jsonData } = useProject();

  const {
    translatedData,
    setTranslatedData,
    isTranslating,
    selectedKeys,
    setSelectedKeys,
    showProgress,
    translationProgress,
    handleTranslation,
    resetTranslationState,
    isCreatingTask,
  } = useTranslationState({
    currentProjectId,
    targetLanguage,
    sourceLanguage,
    jsonData,
  });

  const contextValue = useMemo(
    () => ({
      translatedData,
      setTranslatedData,
      isTranslating,
      selectedKeys,
      setSelectedKeys,
      showProgress,
      translationProgress,
      handleTranslation,
      resetTranslationState,
      isCreatingTask,
    }),
    [
      translatedData,
      setTranslatedData,
      isTranslating,
      selectedKeys,
      setSelectedKeys,
      showProgress,
      translationProgress,
      handleTranslation,
      resetTranslationState,
      isCreatingTask,
    ]
  );

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
