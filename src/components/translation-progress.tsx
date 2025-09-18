// File location: src/components/translation-progress.tsx

'use client';

import { formatTimeRemaining } from '@/lib/translation-helpers';
import type { TranslationProgressDetail } from '@/db/types';

interface TranslationProgressProps {
  translationProgress: TranslationProgressDetail | null | undefined;
  showProgress: boolean;
}

export function TranslationProgress({
  translationProgress,
  showProgress,
}: TranslationProgressProps) {
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
            <span className="text-muted-foreground">Translation Progress</span>
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
}
