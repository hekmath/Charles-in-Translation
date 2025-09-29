// File location: src/app/page.tsx

'use client';

import { LanguageSelector } from '@/components/language-selector';
import { JsonEditor } from '@/components/json-editor';
import { TranslationControls } from '@/components/translation-controls';
import { ComparisonView } from '@/components/comparison-view';
import { ProjectSelector } from '@/components/project-selector';
import { TranslationProgress } from '@/components/translation-progress';
import { ProjectHeader } from '@/components/project-header';
import { LandingSection } from '@/components/landing-section';
import { Toaster } from 'sonner';
import { useProjectState } from '@/lib/hooks/use-project-state';
import { useTranslationState } from '@/lib/hooks/use-translation-state';
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/nextjs';

export default function Home() {
  // Project state management
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

  // Translation state management
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
  } = useTranslationState({
    currentProjectId,
    targetLanguage,
    sourceLanguage,
    jsonData,
  });

  // Handle new file upload
  const handleNewFile = () => {
    resetProjectState();
    resetTranslationState();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-card">
      <Toaster position="bottom-right" />

      {/* Sign-in screen for unauthenticated users */}
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-card">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg mx-auto mb-4">
                <span className="text-primary-foreground font-bold text-2xl">CT</span>
              </div>
              <h1 className="text-3xl font-heading font-black text-foreground tracking-tight">
                Charles in Translation
              </h1>
              <p className="text-muted-foreground mt-2">Admin Tool - Sign in to continue</p>
            </div>
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>

      {/* Main app for authenticated users */}
      <SignedIn>
        {/* Header */}
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

                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12 max-w-7xl">
        {!jsonData ? (
          <LandingSection
            onUpload={handleFileUpload}
            isLoading={isCreatingProject}
          />
        ) : (
          <div className="space-y-8">
            <ProjectHeader
              currentProject={currentProject}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
            />

            <TranslationProgress
              translationProgress={translationProgress}
              showProgress={showProgress}
            />

            <TranslationControls
              hasData={!!jsonData}
              hasTranslation={!!translatedData}
              isTranslating={isTranslating}
              selectedKeysCount={selectedKeys.length}
              onTranslateAll={({ context, cacheProjectId, skipCache }) =>
                handleTranslation({
                  context,
                  cacheProjectId,
                  skipCache,
                })
              }
              onTranslateSelected={({
                context,
                cacheProjectId,
                skipCache,
              }) =>
                handleTranslation({
                  keys: selectedKeys,
                  context,
                  cacheProjectId,
                  skipCache,
                })
              }
              onNewFile={handleNewFile}
              disabled={!targetLanguage || isCreatingProject}
              projects={projects}
              currentProjectId={currentProjectId}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
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
      </SignedIn>
    </div>
  );
}
