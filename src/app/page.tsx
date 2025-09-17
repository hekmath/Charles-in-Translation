'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { FileUpload } from '@/components/file-upload';
import { LanguageSelector } from '@/components/language-selector';
import { JsonEditor } from '@/components/json-editor';
import { TranslationControls } from '@/components/translation-controls';
import { ComparisonView } from '@/components/comparison-view';
import { ProjectSelector } from '@/components/project-selector';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import type { Id } from '../../convex/_generated/dataModel';

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
  const [currentProjectId, setCurrentProjectId] =
    useState<Id<'projects'> | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [usingInngest, setUsingInngest] = useState(false);

  // Track active translation to prevent false completion notifications
  const activeTranslationRef = useRef<{
    taskId?: Id<'translationTasks'>;
    targetLanguage?: string;
    usingInngest?: boolean; // Add this property
  } | null>(null);

  // Convex hooks
  const projects = useQuery(api.translations.getProjects);
  const currentProject = useQuery(
    api.translations.getProject,
    currentProjectId ? { projectId: currentProjectId } : 'skip'
  );
  const translationTasks = useQuery(
    api.translations.getTranslationTasks,
    currentProjectId ? { projectId: currentProjectId } : 'skip'
  );
  const cachedTranslations = useQuery(
    api.translations.getCachedTranslations,
    currentProjectId && targetLanguage
      ? { projectId: currentProjectId, targetLanguage }
      : 'skip'
  );

  // Convex mutations
  const createProject = useMutation(api.translations.createProject);
  const createTranslationTask = useMutation(
    api.translations.createTranslationTask
  );
  const updateTranslationTask = useMutation(
    api.translations.updateTranslationTask
  );
  const saveTranslation = useMutation(api.translations.saveTranslation);

  // Load project data when current project changes
  useEffect(() => {
    if (currentProject) {
      setJsonData(currentProject.originalData);
      setSourceLanguage(currentProject.sourceLanguage);
      setTranslatedData(null);
      setSelectedKeys([]);
      setShowProgress(false);
      setUsingInngest(false);
      activeTranslationRef.current = null;
    }
  }, [currentProject]);

  // Check for completed translation tasks
  useEffect(() => {
    if (translationTasks && activeTranslationRef.current) {
      const { taskId, targetLanguage: activeTargetLang } =
        activeTranslationRef.current;

      const completedTask = translationTasks.find(
        (task) =>
          task._id === taskId &&
          task.status === 'completed' &&
          task.targetLanguage === activeTargetLang
      );

      if (completedTask && completedTask.translatedData) {
        setTranslatedData(completedTask.translatedData);
        setIsTranslating(false);
        toast.success('Translation completed!');
        activeTranslationRef.current = null;
      }

      const failedTask = translationTasks.find(
        (task) =>
          task._id === taskId &&
          task.status === 'failed' &&
          task.targetLanguage === activeTargetLang
      );

      if (failedTask) {
        setIsTranslating(false);
        toast.error(`Translation failed: ${failedTask.error}`);
        activeTranslationRef.current = null;
      }
    }
  }, [translationTasks]);

  // Check for existing translations when target language changes
  useEffect(() => {
    if (
      cachedTranslations &&
      cachedTranslations.length > 0 &&
      jsonData &&
      !isTranslating
    ) {
      const translatedResult = rebuildTranslatedData(
        cachedTranslations,
        jsonData
      );
      if (translatedResult) {
        setTranslatedData(translatedResult);
      }
    }
  }, [cachedTranslations, jsonData, isTranslating]);

  const handleFileUpload = async (data: Record<string, any>) => {
    try {
      const projectId = await createProject({
        name: `Project ${new Date().toLocaleDateString()}`,
        description: `Uploaded JSON with ${
          Object.keys(data).length
        } top-level keys`,
        sourceLanguage,
        originalData: data,
      });

      setCurrentProjectId(projectId);
      setJsonData(data);
      setTranslatedData(null);
      setSelectedKeys([]);
      activeTranslationRef.current = null;

      toast.success('Project created successfully!');
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    }
  };

  const handleTranslation = async (keys?: string[]) => {
    if (!jsonData || !targetLanguage || !currentProjectId) return;

    setIsTranslating(true);

    try {
      // Create translation task
      const taskId = await createTranslationTask({
        projectId: currentProjectId,
        targetLanguage,
        keys: keys || selectedKeys || [],
      });

      // Call API route (now always uses Inngest)
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: jsonData,
          projectId: currentProjectId,
          sourceLanguage,
          targetLanguage,
          selectedKeys: keys || selectedKeys,
          taskId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // All translations now use Inngest - set up progress tracking
        activeTranslationRef.current = {
          taskId,
          targetLanguage,
          usingInngest: true,
        };
        setUsingInngest(true);
        setShowProgress(true);

        toast.success(
          `Translation job queued! Processing ${result.totalKeys} keys in the background.`
        );
      } else {
        throw new Error(result.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation failed:', error);
      toast.error('Failed to start translation');
      setIsTranslating(false);
      setShowProgress(false);
      setUsingInngest(false);
      activeTranslationRef.current = null;
    }
  };

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

  // Helper function to flatten JSON for caching
  const flattenJson = (obj: any, prefix = ''): Record<string, string> => {
    const flattened: Record<string, string> = {};
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        Object.assign(flattened, flattenJson(value, fullKey));
      } else {
        flattened[fullKey] = String(value);
      }
    });
    return flattened;
  };

  const handleEditTranslation = async (key: string, value: string) => {
    if (!currentProjectId) return;
    try {
      const flatOriginal = flattenJson(jsonData || {});
      const originalValue = flatOriginal[key];

      if (originalValue) {
        await saveTranslation({
          projectId: currentProjectId,
          key,
          sourceText: originalValue,
          translatedText: value,
          sourceLanguage,
          targetLanguage,
        });
      }

      if (translatedData) {
        const updated = { ...translatedData };
        const keys = key.split('.');
        let current = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        setTranslatedData(updated);
      }
    } catch (error) {
      console.error('Failed to save edit:', error);
      toast.error('Failed to save edit');
    }
  };

  const handleNewFile = () => {
    setJsonData(null);
    setTranslatedData(null);
    setSelectedKeys([]);
    setCurrentProjectId(null);
    setShowProgress(false);
    setUsingInngest(false);
    activeTranslationRef.current = null;
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
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span>Ready to translate</span>
              </div>

              <ProjectSelector
                projects={projects || []}
                currentProjectId={currentProjectId}
                onProjectChange={setCurrentProjectId}
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
                <FileUpload onUpload={handleFileUpload} />
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
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
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
                  {translatedData && (
                    <div className="flex items-center space-x-2 text-sm text-accent">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      <span className="font-medium">Translation Complete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <TranslationControls
              hasData={!!jsonData}
              hasTranslation={!!translatedData}
              isTranslating={isTranslating}
              selectedKeysCount={selectedKeys.length}
              onTranslateAll={() => handleTranslation([])}
              onTranslateSelected={() => handleTranslation(selectedKeys)}
              onNewFile={handleNewFile}
              disabled={!targetLanguage}
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
                  projectId={currentProjectId as string}
                  originalData={jsonData}
                  translatedData={translatedData}
                  onEdit={handleEditTranslation}
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
