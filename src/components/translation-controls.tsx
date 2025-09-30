'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TranslationContextDialog } from '@/components/translation-context-dialog';
import { useTranslationCacheSources } from '@/lib/hooks/use-api';
import { useProject } from '@/context/project-context';
import { useTranslation } from '@/context/translation-context';

export function TranslationControls() {
  const {
    jsonData,
    projects,
    currentProjectId,
    sourceLanguage,
    targetLanguage,
    resetProjectState,
    isCreatingProject,
  } = useProject();
  const {
    translatedData,
    isTranslating,
    selectedKeys,
    handleTranslation,
    resetTranslationState,
  } = useTranslation();

  const hasData = Boolean(jsonData);
  const hasTranslation = Boolean(translatedData);
  const selectedKeysCount = selectedKeys.length;
  const disabled = !targetLanguage || isCreatingProject;
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'all' | 'selected' | null>(
    null
  );
  const [previousContext, setPreviousContext] = useState('');
  const [selectedCacheOption, setSelectedCacheOption] = useState(
    currentProjectId ? 'current' : 'none'
  );

  const { data: cacheProjectIds = [] } = useTranslationCacheSources(
    sourceLanguage,
    targetLanguage
  );

  useEffect(() => {
    if (!currentProjectId) {
      setSelectedCacheOption('none');
    }
  }, [currentProjectId]);

  const dialogCopy = useMemo(() => {
    if (pendingAction === 'selected') {
      return {
        title: 'Add context for selected keys',
        description:
          'Share any notes the translator should consider while reworking the selected keys. Leave blank if none.',
        confirmLabel: 'Translate selected keys',
      };
    }

    return {
      title: 'Add translation context',
      description:
        'Provide optional product notes, tone guidance, or glossary hints before translating the entire file.',
      confirmLabel: 'Translate all keys',
    };
  }, [pendingAction]);

  const cacheOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [
      { value: 'none', label: 'Do not use cache' },
    ];

    if (currentProjectId) {
      options.push({
        value: 'current',
        label: `Use current project cache (${sourceLanguage.toUpperCase()} → ${targetLanguage.toUpperCase()})`,
      });
    }

    const cacheProjectSet = new Set(cacheProjectIds);

    const compatibleProjects = projects.filter(
      (project) =>
        project.id !== currentProjectId &&
        project.sourceLanguage === sourceLanguage &&
        cacheProjectSet.has(project.id)
    );

    compatibleProjects.forEach((project) => {
      options.push({
        value: `project-${project.id}`,
        label: `${project.name} (${project.sourceLanguage.toUpperCase()} → ${targetLanguage.toUpperCase()})`,
      });
    });

    return options;
  }, [
    projects,
    currentProjectId,
    sourceLanguage,
    targetLanguage,
    cacheProjectIds,
  ]);

  useEffect(() => {
    const optionValues = cacheOptions.map((option) => option.value);
    if (!optionValues.includes(selectedCacheOption)) {
      setSelectedCacheOption(optionValues[0] ?? 'none');
    }
  }, [cacheOptions, selectedCacheOption]);

  const interpretCacheSelection = (option: string | undefined) => {
    if (!option || option === 'none') {
      return { skipCache: true } as const;
    }

    if (option === 'current') {
      return {
        skipCache: false,
        cacheProjectId: currentProjectId ?? undefined,
      } as const;
    }

    if (option.startsWith('project-')) {
      const projectId = Number(option.split('-')[1]);
      if (Number.isFinite(projectId)) {
        return {
          skipCache: false,
          cacheProjectId: projectId,
        } as const;
      }
    }

    return { skipCache: true } as const;
  };

  const closeDialog = () => {
    setContextDialogOpen(false);
    setPendingAction(null);
  };

  const openDialog = (action: 'all' | 'selected') => {
    setPendingAction(action);
    setContextDialogOpen(true);
  };

  const handleConfirm = ({
    context,
    cacheOption,
  }: {
    context?: string;
    cacheOption?: string;
  }) => {
    if (pendingAction === 'selected') {
      handleTranslation({
        context,
        skipCache: true,
        keys: selectedKeys,
      });
    } else if (pendingAction === 'all') {
      const effectiveOption = cacheOption ?? selectedCacheOption;
      setSelectedCacheOption(effectiveOption);

      const cacheSelection = interpretCacheSelection(effectiveOption);

      handleTranslation({
        context,
        cacheProjectId: cacheSelection.cacheProjectId,
        skipCache: cacheSelection.skipCache,
      });
    }

    setPreviousContext(context ?? '');
    if (pendingAction === 'selected' && currentProjectId) {
      setSelectedCacheOption('current');
    }
    closeDialog();
  };

  if (!hasData) return null;

  const dialogCacheOptions =
    pendingAction === 'selected' ? undefined : cacheOptions;

  return (
    <Card className="p-6 bg-gradient-to-r from-card to-muted/30 border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-sm">
              <svg
                className="w-5 h-5 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground">
                Translation Controls
              </h3>
              <p className="text-sm text-muted-foreground">
                {hasTranslation ? 'Translation complete' : 'Ready to translate'}
              </p>
            </div>
          </div>

          {selectedKeysCount > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              {selectedKeysCount} selected
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {selectedKeysCount > 0 && (
            <Button
              onClick={() => openDialog('selected')}
              disabled={disabled || isTranslating}
              variant="secondary"
              className="font-medium shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isTranslating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin"></div>
                  <span>Translating...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Translate Selected</span>
                </div>
              )}
            </Button>
          )}

          <Button
            onClick={() => openDialog('all')}
            disabled={disabled || isTranslating}
            className="font-medium shadow-sm hover:shadow-md transition-all duration-200"
          >
            {isTranslating ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                <span>Translating...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
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
                <span>Translate All</span>
              </div>
            )}
          </Button>

          <Button
            onClick={() => {
              resetProjectState();
              resetTranslationState();
            }}
            variant="outline"
            className="font-medium shadow-sm hover:shadow-md transition-all duration-200 bg-transparent"
          >
            <div className="flex items-center space-x-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>New File</span>
            </div>
          </Button>
        </div>
      </div>

      {disabled && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span>Please select a target language to enable translation</span>
          </div>
        </div>
      )}

      <TranslationContextDialog
        open={contextDialogOpen}
        onOpenChange={(open) => {
          setContextDialogOpen(open);
          if (!open) {
            setPendingAction(null);
          }
        }}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
        title={dialogCopy.title}
        description={dialogCopy.description}
        confirmLabel={dialogCopy.confirmLabel}
        defaultContext={previousContext}
        isSubmitting={isTranslating}
        cacheOptions={dialogCacheOptions}
        selectedCacheOption={selectedCacheOption}
        onCacheOptionChange={setSelectedCacheOption}
      />
    </Card>
  );
}
