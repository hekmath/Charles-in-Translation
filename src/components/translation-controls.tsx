'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TranslationControlsProps {
  hasData: boolean;
  hasTranslation: boolean;
  isTranslating: boolean;
  selectedKeysCount: number;
  onTranslateAll: () => void;
  onTranslateSelected: () => void;
  onNewFile: () => void;
  disabled: boolean;
}

export function TranslationControls({
  hasData,
  hasTranslation,
  isTranslating,
  selectedKeysCount,
  onTranslateAll,
  onTranslateSelected,
  onNewFile,
  disabled,
}: TranslationControlsProps) {
  if (!hasData) return null;

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
              onClick={onTranslateSelected}
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
            onClick={onTranslateAll}
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
            onClick={onNewFile}
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
    </Card>
  );
}
