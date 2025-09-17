'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Id } from '../../convex/_generated/dataModel';

interface TranslationProgressProps {
  projectId: Id<'projects'>;
  targetLanguage: string;
  onComplete?: (translatedData: Record<string, any>) => void;
  onError?: (error: string) => void;
}

export function TranslationProgress({
  projectId,
  targetLanguage,
  onComplete,
  onError,
}: TranslationProgressProps) {
  const [isVisible, setIsVisible] = useState(false);

  const progress = useQuery(api.translations.getTranslationProgress, {
    projectId,
    targetLanguage,
  });

  const currentTask = useQuery(
    api.translations.getTranslationTaskWithProgress,
    progress?.taskId ? { taskId: progress.taskId } : 'skip'
  );

  useEffect(() => {
    if (progress && progress.status === 'processing') {
      setIsVisible(true);
    } else if (
      progress &&
      progress.status === 'completed' &&
      currentTask?.translatedData
    ) {
      setTimeout(() => {
        onComplete?.(currentTask.translatedData);
        setIsVisible(false);
      }, 1000); // Show completion state briefly
    } else if (progress && progress.status === 'failed') {
      onError?.(progress.error || 'Translation failed');
      setIsVisible(false);
    }
  }, [progress, currentTask, onComplete, onError]);

  if (!isVisible || !progress) return null;

  const formatTime = (ms: number | undefined): string => {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-accent" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'processing':
        return 'Translating in progress...';
      case 'completed':
        return 'Translation completed!';
      case 'failed':
        return 'Translation failed';
      default:
        return 'Preparing translation...';
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-heading font-bold text-foreground">
                {getStatusText()}
              </h3>
              <p className="text-sm text-muted-foreground">
                Processing large translation in the background
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            {progress.progressPercentage}%
          </Badge>
        </div>

        {/* Progress bar */}
        {progress.status === 'processing' && (
          <div className="space-y-2">
            <Progress
              value={progress.progressPercentage}
              className="h-2 bg-muted"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Chunk {progress.currentChunk} of {progress.totalChunks}
              </span>
              {progress.estimatedTimeRemaining && (
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatTime(progress.estimatedTimeRemaining)} remaining
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.completedChunks} / {progress.totalChunks} chunks completed
          </span>
          <span>Task ID: {progress.taskId}</span>
        </div>

        {/* Cancel button for processing tasks */}
        {progress.status === 'processing' && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="text-xs"
            >
              Hide Progress
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
