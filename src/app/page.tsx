'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUpload } from '@/components/file-upload';
import { LanguageSelector } from '@/components/language-selector';
import { JsonEditor } from '@/components/json-editor';
import { TranslationControls } from '@/components/translation-controls';
import { ComparisonView } from '@/components/comparison-view';
import { ProjectSelector } from '@/components/project-selector';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/react-query-client';
import {
  useProjects,
  useProject,
  useCreateProject,
  useTranslationTasks,
  useCreateTranslationTask,
  useCachedTranslations,
  useTranslationProgress,
  useTranslate,
} from '@/lib/hooks/use-api';

export default function Home() {
  // Local state
  const [jsonData, setJsonData] = useState<Record<string, any> | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [translatedData, setTranslatedData] = useState<Record<
    string,
    any
  > | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // Track active translation to prevent false completion notifications
  const activeTranslationRef = useRef<{
    taskId?: number;
    targetLanguage?: string;
  } | null>(null);

  // React Query hooks
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: currentProject } = useProject(currentProjectId);
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
  const createProjectMutation = useCreateProject();
  const createTranslationTaskMutation = useCreateTranslationTask();
  const translateMutation = useTranslate();

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Load project data when current project changes
  useEffect(() => {
    if (currentProject) {
      setJsonData(currentProject.originalData);
      setSourceLanguage(currentProject.sourceLanguage);
      setTranslatedData(null);
      setSelectedKeys([]);
      setShowProgress(false);
      setIsTranslating(false);
      activeTranslationRef.current = null;
    }
  }, [currentProject]);

  // Enhanced completion detection using the new progress structure
  useEffect(() => {
    if (translationProgress?.status === 'completed' && isTranslating) {
      console.log('Translation completed! Refreshing data...');

      // Force refresh the translation tasks to get the latest data
      if (currentProjectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.translationTasks.list(currentProjectId),
        });
      }
    }

    if (translationProgress?.status === 'failed' && isTranslating) {
      console.log('Translation failed:', translationProgress.error);
      setIsTranslating(false);
      setShowProgress(false);
      activeTranslationRef.current = null;
      toast.error(
        `Translation failed: ${translationProgress.error || 'Unknown error'}`
      );
    }
  }, [translationProgress, isTranslating, currentProjectId, queryClient]);

  // Detect completion after cache refresh
  useEffect(() => {
    if (!isTranslating || !activeTranslationRef.current) return;

    const { taskId } = activeTranslationRef.current;

    // Look for the completed task in the refreshed data
    const completedTask = translationTasks?.find(
      (task) =>
        task.id === taskId && task.status === 'completed' && task.translatedData
    );

    if (completedTask) {
      console.log('Completed task found after cache refresh!', completedTask);
      setTranslatedData(completedTask.translatedData);
      setIsTranslating(false);
      setShowProgress(false);
      activeTranslationRef.current = null;
      toast.success('Translation completed!');
    }
  }, [translationTasks, isTranslating]);

  // Auto-restore from cached translations
  useEffect(() => {
    if (
      cachedTranslations &&
      cachedTranslations.length > 0 &&
      jsonData &&
      !isTranslating &&
      !translatedData
    ) {
      console.log(
        'Restoring translation from cache...',
        cachedTranslations.length,
        'cached translations'
      );
      const translatedResult = rebuildTranslatedData(
        cachedTranslations,
        jsonData
      );
      if (translatedResult) {
        setTranslatedData(translatedResult);
        console.log('Translation restored from cache!');
      }
    }
  }, [cachedTranslations, jsonData, isTranslating, translatedData]);

  // Helper function to rebuild translated data from cached translations
  const rebuildTranslatedData = (
    translations: Array<{ key: string; translatedText: string }>,
    originalData: Record<string, any>
  ): Record<string, any> | null => {
    const translatedMap = new Map(
      translations.map((t) => [t.key, t.translatedText])
    );

    const rebuild = (obj: any, prefix = ''): any => {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj;
      }
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          result[key] = rebuild(value, fullKey);
        } else {
          result[key] = translatedMap.get(fullKey) || value;
        }
      }
      return result;
    };

    return rebuild(originalData);
  };

  const handleFileUpload = async (data: Record<string, any>) => {
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
      setTranslatedData(null);
      setSelectedKeys([]);
      activeTranslationRef.current = null;
    } catch (error) {
      console.error('Failed to create project:', error);
      // Error handling is done in the mutation hook
    }
  };

  const handleTranslation = async (keys?: string[]) => {
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
  };

  const handleNewFile = () => {
    setJsonData(null);
    setTranslatedData(null);
    setSelectedKeys([]);
    setCurrentProjectId(null);
    setShowProgress(false);
    setIsTranslating(false);
    activeTranslationRef.current = null;
  };

  // Enhanced progress display component
  const ProgressDisplay = () => {
    if (!showProgress || !translationProgress) return null;

    const {
      totalKeys,
      translatedKeys,
      totalChunks,
      completedChunks,
      failedChunks,
      status,
      estimatedTimeRemaining,
    } = translationProgress;

    const formatTimeRemaining = (ms: number | null) => {
      if (!ms) return 'Calculating...';
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    };

    return (
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-sm">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground">
                Translation in Progress
              </h3>
              <p className="text-sm text-muted-foreground capitalize">
                Status: {status}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {translatedKeys} / {totalKeys}
            </div>
            <div className="text-sm text-muted-foreground">keys translated</div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          {/* Key progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                Translation Progress
              </span>
              <span className="text-foreground font-medium">
                {totalKeys > 0
                  ? Math.round((translatedKeys / totalKeys) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>

          {/* Chunk progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Chunk Progress</span>
              <span className="text-foreground font-medium">
                {completedChunks} / {totalChunks} chunks
                {failedChunks > 0 && (
                  <span className="text-destructive ml-1">
                    ({failedChunks} failed)
                  </span>
                )}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-gradient-to-r from-accent to-accent/70 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Time estimate */}
        {estimatedTimeRemaining && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Estimated time remaining:{' '}
            {formatTimeRemaining(estimatedTimeRemaining)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-card">
      <Toaster position="bottom-right" />

      <header className="border-b border-border/60 bg-background/95 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-primary-foreground font-bold text-lg">
                    CT
                  </span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-heading font-black text-foreground tracking-tight">
                  Charles in Translation
                </h1>
                <p className="text-sm text-muted-foreground font-medium">
                  AI-powered JSON localization platform
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Ready to translate</span>
              </div>

              <ProjectSelector
                projects={projects}
                currentProjectId={currentProjectId}
                onProjectChange={setCurrentProjectId}
                isLoading={projectsLoading}
              />

              <LanguageSelector
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
                onSourceChange={setSourceLanguage}
                onTargetChange={setTargetLanguage}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {!jsonData ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl scale-150"></div>
              <div className="relative bg-card border border-border/50 rounded-2xl p-8 shadow-xl">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg
                    className="w-8 h-8 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h2 className="text-3xl font-heading font-black text-foreground mb-4 text-balance">
                  Start Your Translation Journey
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto text-pretty">
                  Upload your JSON files and let AI handle the heavy lifting.
                  Professional localization made simple.
                </p>
                <FileUpload
                  onUpload={handleFileUpload}
                  isLoading={createProjectMutation.isPending}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                  <svg
                    className="w-6 h-6 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="font-heading font-bold text-foreground">
                  Lightning Fast
                </h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered translations in seconds
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto">
                  <svg
                    className="w-6 h-6 text-secondary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-heading font-bold text-foreground">
                  Quality Assured
                </h3>
                <p className="text-sm text-muted-foreground">
                  Professional-grade accuracy
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto">
                  <svg
                    className="w-6 h-6 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                    />
                  </svg>
                </div>
                <h3 className="font-heading font-bold text-foreground">
                  Full Control
                </h3>
                <p className="text-sm text-muted-foreground">
                  Edit and refine every translation
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-sm">
                    <svg
                      className="w-6 h-6 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-foreground">
                      {currentProject?.name || 'Current Project'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {Object.keys(jsonData).length} keys •{' '}
                      {sourceLanguage.toUpperCase()} →{' '}
                      {targetLanguage.toUpperCase() || 'Select target'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {translatedData && !isTranslating && (
                    <div className="flex items-center space-x-2 text-sm text-accent">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      <span className="font-medium">Translation Complete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced progress display */}
            {showProgress && <ProgressDisplay />}

            <TranslationControls
              hasData={!!jsonData}
              hasTranslation={!!translatedData}
              isTranslating={isTranslating}
              selectedKeysCount={selectedKeys.length}
              onTranslateAll={() => handleTranslation([])}
              onTranslateSelected={() => handleTranslation(selectedKeys)}
              onNewFile={handleNewFile}
              disabled={!targetLanguage || createProjectMutation.isPending}
            />

            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
              {!translatedData ? (
                <JsonEditor
                  data={jsonData}
                  onChange={setJsonData}
                  selectedKeys={selectedKeys}
                  onSelectionChange={setSelectedKeys}
                  language={sourceLanguage}
                />
              ) : (
                <ComparisonView
                  projectId={currentProjectId!}
                  originalData={jsonData}
                  translatedData={translatedData}
                  sourceLanguage={sourceLanguage}
                  targetLanguage={targetLanguage}
                  onTranslationUpdate={setTranslatedData}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
