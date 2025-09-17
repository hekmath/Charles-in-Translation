'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Edit3,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface TranslationTableProps {
  originalData: Record<string, any>;
  translatedData: Record<string, any>;
  onEdit: (key: string, value: string) => void;
  onRetranslate: (keys: string[]) => Promise<void>;
  sourceLanguage: string;
  targetLanguage: string;
}

interface FlattenedItem {
  key: string;
  original: string;
  translated: string;
  isEditing?: boolean;
  editValue?: string;
}

export function TranslationTable({
  originalData,
  translatedData,
  onEdit,
  onRetranslate,
  sourceLanguage,
  targetLanguage,
}: TranslationTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [retranslatingKeys, setRetranslatingKeys] = useState<Set<string>>(
    new Set()
  );

  // Flatten nested objects for table display
  const flattenedData = useMemo(() => {
    const flattenObject = (obj: any, prefix = ''): Record<string, string> => {
      const flattened: Record<string, string> = {};
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          Object.assign(flattened, flattenObject(value, fullKey));
        } else {
          flattened[fullKey] = String(value);
        }
      });
      return flattened;
    };

    const originalFlat = flattenObject(originalData);
    const translatedFlat = flattenObject(translatedData);

    const items: FlattenedItem[] = Object.keys(originalFlat).map((key) => ({
      key,
      original: originalFlat[key] || '',
      translated: translatedFlat[key] || '',
    }));

    return items;
  }, [originalData, translatedData]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return flattenedData;
    const term = searchTerm.toLowerCase();
    return flattenedData.filter(
      (item) =>
        item.key.toLowerCase().includes(term) ||
        item.original.toLowerCase().includes(term) ||
        item.translated.toLowerCase().includes(term)
    );
  }, [flattenedData, searchTerm]);

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = async (key: string) => {
    try {
      await onEdit(key, editValue);
      setEditingKey(null);
      setEditValue('');
      toast.success('Translation updated');
    } catch (error) {
      toast.error('Failed to update translation');
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleRetranslate = async (key: string) => {
    setRetranslatingKeys((prev) => new Set([...prev, key]));
    try {
      await onRetranslate([key]);
      toast.success('Re-translation completed');
    } catch (error) {
      toast.error('Re-translation failed');
    } finally {
      setRetranslatingKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const getRowClassName = (item: FlattenedItem) => {
    if (!item.translated)
      return 'bg-destructive/5 border-l-4 border-destructive/50';
    if (item.original === item.translated)
      return 'bg-yellow-50 dark:bg-yellow-950/10 border-l-4 border-yellow-500/50';
    return 'bg-card hover:bg-muted/30 transition-colors duration-200';
  };

  const getStatusBadge = (item: FlattenedItem) => {
    if (!item.translated)
      return (
        <Badge variant="destructive" className="text-xs">
          Missing
        </Badge>
      );
    if (item.original === item.translated)
      return (
        <Badge variant="secondary" className="text-xs">
          Untranslated
        </Badge>
      );
    return (
      <Badge
        variant="default"
        className="text-xs bg-accent text-accent-foreground"
      >
        Translated
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden shadow-sm">
      {/* Header with search */}
      <div className="border-b border-border p-4 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <h3 className="font-heading font-bold text-foreground">
                Translation Table
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="border-primary/30">
                {filteredData.length} items
              </Badge>
              <Badge variant="outline" className="border-accent/30">
                {sourceLanguage.toUpperCase()} → {targetLanguage.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search translations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 bg-background border-border/50 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-muted/70 to-muted/50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                Key
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                Original ({sourceLanguage.toUpperCase()})
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                Translation ({targetLanguage.toUpperCase()})
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                Status
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr
                key={item.key}
                className={`border-b border-border/50 ${getRowClassName(item)}`}
              >
                <td className="p-4 border-r border-border/30">
                  <code className="text-sm font-mono bg-muted/50 px-2 py-1 rounded-md text-foreground break-all">
                    {item.key}
                  </code>
                </td>
                <td className="p-4 border-r border-border/30">
                  <div className="max-w-xs">
                    <p className="text-sm text-foreground break-words leading-relaxed">
                      {item.original}
                    </p>
                  </div>
                </td>
                <td className="p-4 border-r border-border/30">
                  <div className="max-w-xs">
                    {editingKey === item.key ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="min-h-[80px] text-sm border-primary/50 focus:border-primary"
                          autoFocus
                          placeholder="Enter translation..."
                        />
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(item.key)}
                            className="h-7 px-3 bg-accent hover:bg-accent/90"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            className="h-7 px-3"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground break-words leading-relaxed">
                        {item.translated || (
                          <span className="text-muted-foreground italic flex items-center space-x-1">
                            <AlertCircle className="w-3 h-3 text-destructive" />
                            <span>No translation</span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </td>
                <td className="p-4 border-r border-border/30">
                  {getStatusBadge(item)}
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    {editingKey !== item.key && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item.key, item.translated)}
                          className="h-8 w-8 p-0 hover:bg-primary/10 hover:border-primary/50"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetranslate(item.key)}
                          disabled={retranslatingKeys.has(item.key)}
                          className="h-8 w-8 p-0 hover:bg-secondary/10 hover:border-secondary/50"
                        >
                          {retranslatingKeys.has(item.key) ? (
                            <div className="w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h4 className="font-heading font-semibold text-foreground mb-2">
              No translations found
            </h4>
            <p className="text-sm">
              Try adjusting your search terms or check if translations exist.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
