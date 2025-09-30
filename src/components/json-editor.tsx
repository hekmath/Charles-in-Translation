'use client';

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Code,
  Eye,
  CheckSquare,
  Square,
  RotateCcw,
  Download,
  Copy,
  AlertCircle,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { editor } from 'monaco-editor';
import { isJsonObject, type JsonValue } from '@/types/json';
import { collectJsonKeys } from '@/lib/json-utils';
import { useProject } from '@/context/project-context';
import { useTranslation } from '@/context/translation-context';

export function JsonEditor() {
  const { jsonData, setJsonData, sourceLanguage } = useProject();
  const { selectedKeys, setSelectedKeys } = useTranslation();
  const [viewMode, setViewMode] = useState<'code' | 'tree'>('code');
  const [jsonString, setJsonString] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [translatableKeys, setTranslatableKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!jsonData) {
      setJsonString('');
      setAllKeys([]);
      setTranslatableKeys([]);
      return;
    }

    setJsonString(JSON.stringify(jsonData, null, 2));
    const {
      allKeys: extractedAllKeys,
      translatableKeys: extractedTranslatableKeys,
    } = collectJsonKeys(jsonData);
    setAllKeys(extractedAllKeys);
    setTranslatableKeys(extractedTranslatableKeys);
  }, [jsonData]);

  // Get all child keys for a given parent key
  const getChildKeys = (parentKey: string): string[] => {
    return allKeys.filter(
      (key) => key.startsWith(parentKey + '.') && key !== parentKey
    );
  };

  // Get direct child keys only (not grandchildren)
  const getDirectChildKeys = (parentKey: string): string[] => {
    const prefix = parentKey + '.';
    return allKeys.filter((key) => {
      if (!key.startsWith(prefix)) return false;
      const remainder = key.substring(prefix.length);
      return !remainder.includes('.'); // No further dots = direct child
    });
  };

  // Get parent key for a given key
  const getParentKey = (key: string): string | null => {
    const lastDotIndex = key.lastIndexOf('.');
    return lastDotIndex > 0 ? key.substring(0, lastDotIndex) : null;
  };

  // Check if a key has children
  const hasChildren = (key: string): boolean => {
    return allKeys.some((k) => k.startsWith(key + '.'));
  };

  // Get selection state for a key (selected, unselected, or partially selected)
  const getSelectionState = (
    key: string
  ): 'selected' | 'unselected' | 'partial' => {
    const isSelected = selectedKeys.includes(key);

    if (!hasChildren(key)) {
      return isSelected ? 'selected' : 'unselected';
    }

    const childKeys = getChildKeys(key);
    const selectedChildKeys = childKeys.filter((childKey) =>
      selectedKeys.includes(childKey)
    );

    if (selectedChildKeys.length === 0) {
      return isSelected ? 'selected' : 'unselected';
    } else if (selectedChildKeys.length === childKeys.length) {
      return 'selected';
    } else {
      return 'partial';
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;

    setJsonString(value);

    try {
      const parsedData = JSON.parse(value) as unknown;
      if (!isJsonObject(parsedData)) {
        throw new Error('Parsed JSON is not an object');
      }
      setIsValid(true);
      setJsonData(parsedData);
    } catch (error) {
      console.error('Failed to parse JSON input:', error);
      setIsValid(false);
    }
  };

  const toggleKeySelection = (key: string) => {
    const currentState = getSelectionState(key);
    let newSelection = [...selectedKeys];

    if (currentState === 'selected') {
      // Deselect this key and all its children
      newSelection = newSelection.filter(
        (selectedKey) =>
          selectedKey !== key && !selectedKey.startsWith(key + '.')
      );
    } else {
      // Select this key and all its children
      const childKeys = getChildKeys(key);
      const keysToAdd = [key, ...childKeys].filter(
        (k) => !newSelection.includes(k)
      );
      newSelection = [...newSelection, ...keysToAdd];
    }

    // Update parent selection states
    newSelection = updateParentSelections(newSelection);

    setSelectedKeys(newSelection);
  };

  // Update parent selections based on child selections
  const updateParentSelections = (selection: string[]): string[] => {
    let updatedSelection = [...selection];

    // Get all parent keys that might need updating
    const parentKeys = new Set<string>();
    selection.forEach((key) => {
      let parent = getParentKey(key);
      while (parent) {
        parentKeys.add(parent);
        parent = getParentKey(parent);
      }
    });

    // Check each parent key
    parentKeys.forEach((parentKey) => {
      const childKeys = getChildKeys(parentKey);
      const selectedChildKeys = childKeys.filter((childKey) =>
        updatedSelection.includes(childKey)
      );

      if (
        selectedChildKeys.length === childKeys.length &&
        childKeys.length > 0
      ) {
        // All children selected - select parent
        if (!updatedSelection.includes(parentKey)) {
          updatedSelection.push(parentKey);
        }
      } else {
        // Not all children selected - deselect parent
        updatedSelection = updatedSelection.filter((k) => k !== parentKey);
      }
    });

    return updatedSelection;
  };

  const selectAll = () => {
    setSelectedKeys(allKeys);
  };

  const selectAllTranslatable = () => {
    setSelectedKeys(translatableKeys);
  };

  const selectNone = () => {
    setSelectedKeys([]);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      toast.success('JSON copied to clipboard');
    } catch (error) {
      console.error('Failed to copy JSON to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sourceLanguage}_translations.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('JSON file downloaded');
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonString) as unknown;
      if (!isJsonObject(parsed)) {
        throw new Error('Parsed JSON is not an object');
      }
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonString(formatted);
      setJsonData(parsed);
      toast.success('JSON formatted');
    } catch (error) {
      console.error('Failed to format JSON:', error);
      toast.error('Invalid JSON - cannot format');
    }
  };

  // Render tree view with proper hierarchical selection
  const renderTreeItem = (
    obj: JsonValue,
    prefix = '',
    level = 0
  ): React.JSX.Element[] => {
    if (!isJsonObject(obj)) {
      return [];
    }

    return (Object.entries(obj) as Array<[string, JsonValue]>).map(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const hasChildNodes = isJsonObject(value);
      const isExpanded = expandedKeys.has(fullKey);
      const selectionState = getSelectionState(fullKey);
      const isTranslatable = typeof value === 'string' && value.trim() !== '';

      const SelectionIcon = () => {
        switch (selectionState) {
          case 'selected':
            return <CheckSquare className="w-4 h-4 text-primary" />;
          case 'partial':
            return <Minus className="w-4 h-4 text-secondary" />;
          default:
            return <Square className="w-4 h-4 text-muted-foreground" />;
        }
      };

      return (
        <div key={fullKey} className="border-l border-border ml-4">
          <div
            className={`
              flex items-center space-x-2 py-2 px-3 hover:bg-muted/50 rounded-r-lg transition-colors duration-200
              ${
                selectionState === 'selected'
                  ? 'bg-primary/10 border-r-2 border-primary'
                  : selectionState === 'partial'
                  ? 'bg-secondary/10 border-r-2 border-secondary'
                  : ''
              }
              ${isTranslatable ? 'bg-green-50 dark:bg-green-950/10' : ''}
            `}
            style={{ paddingLeft: `${level * 12}px` }}
          >
            {hasChildNodes && (
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedKeys);
                  if (isExpanded) {
                    newExpanded.delete(fullKey);
                  } else {
                    newExpanded.add(fullKey);
                  }
                  setExpandedKeys(newExpanded);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}

            <button
              onClick={() => toggleKeySelection(fullKey)}
              className="flex items-center space-x-2 flex-1 text-left hover:bg-muted/30 rounded px-2 py-1 transition-colors"
            >
              <SelectionIcon />

              <span className="font-mono text-sm font-medium text-foreground">
                {key}
              </span>
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {typeof value === 'string' ? `"${value}"` : String(value)}
              </span>

              <Badge variant="outline" className="text-xs">
                {typeof value}
              </Badge>

              {isTranslatable && (
                <Badge
                  variant="default"
                  className="text-xs bg-green-600 text-white"
                >
                  translatable
                </Badge>
              )}

              {hasChildNodes && (
                <Badge variant="secondary" className="text-xs">
                  {getDirectChildKeys(fullKey).length} items
                </Badge>
              )}
            </div>
          </div>

          {hasChildNodes && isExpanded && (
            <div className="ml-4">
              {renderTreeItem(value, fullKey, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (!jsonData) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="flex border border-border rounded-lg p-1 bg-background">
                <Button
                  variant={viewMode === 'code' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('code')}
                  className="h-8"
                >
                  <Code className="w-4 h-4 mr-1" />
                  Code
                </Button>
                <Button
                  variant={viewMode === 'tree' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('tree')}
                  className="h-8"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Tree
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Badge
                variant={isValid ? 'default' : 'destructive'}
                className="flex items-center space-x-1"
              >
                {!isValid && <AlertCircle className="w-3 h-3" />}
                <span>{isValid ? 'Valid JSON' : 'Invalid JSON'}</span>
              </Badge>
              <Badge
                variant="outline"
                title="Total keys including objects, numbers, booleans"
              >
                {allKeys.length} total keys
              </Badge>
              <Badge
                variant="default"
                className="bg-green-600"
                title="Only string values that can be translated"
              >
                {translatableKeys.length} translatable
              </Badge>
              {selectedKeys.length > 0 && (
                <Badge variant="secondary">
                  {selectedKeys.length} selected
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {viewMode === 'tree' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllTranslatable}
                >
                  Select Translatable
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Clear
                </Button>
              </>
            )}

            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={formatJson}
              disabled={!isValid}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={downloadJson}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {viewMode === 'code' ? (
          <Editor
            height="500px"
            language="json"
            theme="vs-light"
            value={jsonString}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              formatOnPaste: true,
              formatOnType: true,
              tabSize: 2,
              insertSpaces: true,
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        ) : (
          <div className="p-4 max-h-[500px] overflow-y-auto">
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <strong>Key Types:</strong>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 dark:bg-green-950/30 border border-green-300 rounded"></div>
                    <span>
                      Translatable strings ({translatableKeys.length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-muted border border-border rounded"></div>
                    <span>
                      Objects, numbers, booleans (
                      {allKeys.length - translatableKeys.length})
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">{renderTreeItem(jsonData)}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
