'use client';

import { useState } from 'react';
import {
  Download,
  Copy,
  ArrowRight,
  Languages,
  FileText,
  Code,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { getLanguageByCode, type Language } from '@/lib/constants/languages';
import { TranslationTable } from '@/components/translation-table';
import {
  useSaveTranslation,
  useRetranslate, // New hook for retranslation
} from '@/lib/hooks/use-api';

interface ComparisonViewProps {
  originalData: Record<string, any>;
  translatedData: Record<string, any>;
  sourceLanguage: string;
  targetLanguage: string;
  projectId: number;
  onTranslationUpdate?: (newTranslatedData: Record<string, any>) => void;
}

export function ComparisonView({
  originalData,
  translatedData,
  sourceLanguage,
  targetLanguage,
  projectId,
  onTranslationUpdate,
}: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'table'>('table');

  // React Query mutations with proper cache invalidation
  const saveTranslationMutation = useSaveTranslation();
  const retranslateMutation = useRetranslate();

  const getLanguageInfo = (code: string): Language =>
    getLanguageByCode(code) || { code, name: code.toUpperCase(), flag: '🌐' };

  const sourceInfo = getLanguageInfo(sourceLanguage);
  const targetInfo = getLanguageInfo(targetLanguage);

  const downloadTranslation = () => {
    const blob = new Blob([JSON.stringify(translatedData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translated_${targetLanguage}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Translation downloaded');
  };

  const copyTranslation = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(translatedData, null, 2)
      );
      toast.success('Translation copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Enhanced retranslate function with proper cache invalidation
  const handleRetranslate = async (keys: string[]): Promise<void> => {
    try {
      await retranslateMutation.mutateAsync({
        projectId,
        sourceLanguage,
        targetLanguage,
        keys,
        originalData,
      });

      // Note: Cache invalidation is handled in the useRetranslate hook
      // This ensures the UI updates immediately when retranslation starts
      // and the comparison view will show updated data when translation completes
    } catch (error) {
      console.error('Re-translation failed:', error);
      // Error toast is handled by the mutation hook
      throw error;
    }
  };

  // Enhanced edit function with optimistic updates
  const handleEdit = async (key: string, value: string): Promise<void> => {
    try {
      // Get the original value for this key
      const flatOriginal = flattenJson(originalData);
      const originalValue = flatOriginal[key];

      if (!originalValue) {
        toast.error('Original value not found for this key');
        return;
      }

      // Save the translation (with optimistic update)
      await saveTranslationMutation.mutateAsync({
        projectId,
        key,
        sourceText: originalValue,
        translatedText: value,
        sourceLanguage,
        targetLanguage,
      });

      // Update local state immediately for responsiveness
      if (translatedData && onTranslationUpdate) {
        const updated = { ...translatedData };
        const keys = key.split('.');
        let current = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        onTranslationUpdate(updated);
      }

      // Note: Database save and cache invalidation is handled by useSaveTranslation hook
      // The hook includes optimistic updates, so UI responds immediately
    } catch (error) {
      console.error('Failed to save edit:', error);
      // Error toast is handled by the mutation hook
    }
  };

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

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-r from-card to-muted/30 border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Languages className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-foreground">
                Translation Results
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Badge
                variant="outline"
                className="flex items-center space-x-1 border-primary/30"
              >
                <span className="text-lg">{sourceInfo.flag}</span>
                <span>{sourceInfo.name}</span>
              </Badge>
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <ArrowRight className="w-3 h-3 text-primary-foreground" />
              </div>
              <Badge
                variant="outline"
                className="flex items-center space-x-1 border-secondary/30"
              >
                <span className="text-lg">{targetInfo.flag}</span>
                <span>{targetInfo.name}</span>
              </Badge>
            </div>

            {/* Show loading states for mutations */}
            {(saveTranslationMutation.isPending ||
              retranslateMutation.isPending) && (
              <Badge variant="secondary" className="animate-pulse">
                {saveTranslationMutation.isPending
                  ? 'Saving...'
                  : 'Retranslating...'}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex border border-border rounded-lg p-1 bg-background">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8"
              >
                <FileText className="w-4 h-4 mr-1" />
                Table
              </Button>
              <Button
                variant={viewMode === 'side-by-side' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('side-by-side')}
                className="h-8"
              >
                <Code className="w-4 h-4 mr-1" />
                Code
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={copyTranslation}
              className="shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTranslation}
              className="shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </Card>

      {viewMode === 'table' ? (
        <TranslationTable
          originalData={originalData}
          translatedData={translatedData}
          onEdit={handleEdit}
          onRetranslate={handleRetranslate}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          // Pass loading states to show pending operations
          isEditLoading={saveTranslationMutation.isPending}
          isRetranslateLoading={retranslateMutation.isPending}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden shadow-sm">
            <div className="border-b p-3 bg-gradient-to-r from-muted/50 to-muted/30">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{sourceInfo.flag}</span>
                <span className="font-medium text-foreground">
                  Original ({sourceInfo.name})
                </span>
                <Badge variant="secondary" className="text-xs">
                  Read-only
                </Badge>
              </div>
            </div>
            <div className="h-[600px]">
              <Editor
                height="600px"
                language="json"
                theme="vs-light"
                value={JSON.stringify(originalData, null, 2)}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>

          <Card className="overflow-hidden shadow-sm">
            <div className="border-b p-3 bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{targetInfo.flag}</span>
                  <span className="font-medium text-foreground">
                    Translated ({targetInfo.name})
                  </span>
                  <Badge variant="default" className="text-xs">
                    Editable
                  </Badge>
                  {/* Show mutation status */}
                  {saveTranslationMutation.isPending && (
                    <Badge
                      variant="secondary"
                      className="text-xs animate-pulse"
                    >
                      Saving...
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="shadow-sm"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Edit in Table
                </Button>
              </div>
            </div>
            <div className="h-[600px]">
              <Editor
                height="600px"
                language="json"
                theme="vs-light"
                value={JSON.stringify(translatedData, null, 2)}
                onChange={(value) => {
                  if (value && onTranslationUpdate) {
                    try {
                      const parsed = JSON.parse(value);
                      onTranslationUpdate(parsed);
                    } catch {
                      // ignore invalid JSON in editor
                    }
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  formatOnPaste: true,
                  formatOnType: true,
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
