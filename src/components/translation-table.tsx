'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Edit3,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  FileText,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { isJsonObject, type JsonObject, type JsonValue } from '@/types/json';
import { TranslationContextDialog } from '@/components/translation-context-dialog';

interface TranslationTableProps {
  originalData: JsonObject;
  translatedData: JsonObject;
  onEdit: (key: string, value: string) => Promise<void>;
  onRetranslate: (keys: string[], context?: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  sourceLanguage: string;
  targetLanguage: string;
  isEditLoading?: boolean;
  isRetranslateLoading?: boolean;
  isRefreshLoading?: boolean;
}

interface FlattenedItem {
  key: string;
  original: string;
  translated: string;
  status: 'missing' | 'untranslated' | 'translated';
  isEditing?: boolean;
  editValue?: string;
}

type SortField = 'key' | 'original' | 'translated' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'missing' | 'untranslated' | 'translated';

export function TranslationTable({
  originalData,
  translatedData,
  onEdit,
  onRetranslate,
  onRefresh,
  sourceLanguage,
  targetLanguage,
  isEditLoading = false,
  isRetranslateLoading = false,
  isRefreshLoading = false,
}: TranslationTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [retranslatingKeys, setRetranslatingKeys] = useState<Set<string>>(
    new Set()
  );
  const [selectedForBulkRetranslation, setSelectedForBulkRetranslation] =
    useState<Set<string>>(new Set());
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [pendingRetranslateKeys, setPendingRetranslateKeys] = useState<
    string[] | null
  >(null);
  const [previousContext, setPreviousContext] = useState('');

  const dialogCopy = useMemo(() => {
    const count = pendingRetranslateKeys?.length ?? 0;

    if (count > 1) {
      return {
        title: 'Add context for retranslation',
        description: `Share any background information or guidance for retranslating ${count} keys. Leave blank to reuse existing wording style.`,
        confirmLabel: `Retranslate ${count} keys`,
      };
    }

    return {
      title: 'Add context for this key',
      description:
        'Provide optional hints, product notes, or tone guidance before re-running the translation for this key.',
      confirmLabel: 'Retranslate key',
    };
  }, [pendingRetranslateKeys]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Flatten nested objects for table display
  const flattenedData = useMemo(() => {
    const flattenObject = (
      obj: JsonValue,
      prefix = ''
    ): Record<string, string> => {
      const flattened: Record<string, string> = {};

      if (!isJsonObject(obj)) {
        return flattened;
      }

      for (const [key, value] of Object.entries(obj) as Array<[
        string,
        JsonValue,
      ]>) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (isJsonObject(value)) {
          Object.assign(flattened, flattenObject(value, fullKey));
        } else {
          flattened[fullKey] = String(value);
        }
      }

      return flattened;
    };

    const originalFlat = flattenObject(originalData);
    const translatedFlat = flattenObject(translatedData);

    const items: FlattenedItem[] = Object.keys(originalFlat).map((key) => {
      const original = originalFlat[key] || '';
      const translated = translatedFlat[key] || '';

      let status: 'missing' | 'untranslated' | 'translated';
      if (!translated) {
        status = 'missing';
      } else if (original === translated) {
        status = 'untranslated';
      } else {
        status = 'translated';
      }

      return {
        key,
        original,
        translated,
        status,
      };
    });

    return items;
  }, [originalData, translatedData]);

  // Filter data based on search term and status filter
  const filteredData = useMemo(() => {
    let filtered = flattenedData;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.key.toLowerCase().includes(term) ||
          item.original.toLowerCase().includes(term) ||
          item.translated.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    return filtered;
  }, [flattenedData, searchTerm, statusFilter]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'status':
          // Custom sort order: translated, untranslated, missing (shows completed work first)
          const statusOrder = { translated: 0, untranslated: 1, missing: 2 };
          aValue = statusOrder[a.status];
          bValue = statusOrder[b.status];
          break;
        case 'key':
          aValue = a.key.toLowerCase();
          bValue = b.key.toLowerCase();
          break;
        case 'original':
          aValue = a.original.toLowerCase();
          bValue = b.original.toLowerCase();
          break;
        case 'translated':
          aValue = a.translated.toLowerCase();
          bValue = b.translated.toLowerCase();
          break;
        default:
          aValue = a.key.toLowerCase();
          bValue = b.key.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredData, sortField, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  // Calculate pagination info
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startItem =
    sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, sortedData.length);

  // Get statistics for display
  const stats = useMemo(() => {
    const missing = flattenedData.filter(
      (item) => item.status === 'missing'
    ).length;
    const untranslated = flattenedData.filter(
      (item) => item.status === 'untranslated'
    ).length;
    const translated = flattenedData.filter(
      (item) => item.status === 'translated'
    ).length;

    return { missing, untranslated, translated, total: flattenedData.length };
  }, [flattenedData]);

  // Reset pagination when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    resetPagination();
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = async (key: string) => {
    if (isEditLoading) return;

    try {
      await onEdit(key, editValue);
      setEditingKey(null);
      setEditValue('');
    } catch (error) {
      console.error(`Failed to save translation for key ${key}:`, error);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleRetranslate = (key: string) => {
    if (isRetranslateLoading) return;

    setPendingRetranslateKeys([key]);
    setContextDialogOpen(true);
  };

  const handleBulkRetranslate = () => {
    if (selectedForBulkRetranslation.size === 0 || isRetranslateLoading) return;

    setPendingRetranslateKeys(Array.from(selectedForBulkRetranslation));
    setContextDialogOpen(true);
  };

  const submitRetranslation = async (context?: string) => {
    if (!pendingRetranslateKeys?.length) {
      setContextDialogOpen(false);
      setPendingRetranslateKeys(null);
      return;
    }

    const keys = pendingRetranslateKeys;
    setContextDialogOpen(false);
    setPreviousContext(context ?? '');
    setRetranslatingKeys(new Set(keys));

    try {
      await onRetranslate(keys, context);
      if (keys.length > 1) {
        setSelectedForBulkRetranslation(new Set());
      }
    } catch (error) {
      console.error('Failed to retranslate keys:', error);
    } finally {
      setRetranslatingKeys(new Set());
      setPendingRetranslateKeys(null);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshLoading) return;

    try {
      await onRefresh();
      toast.success('Translation data refreshed');
    } catch (error) {
      console.error('Failed to refresh translation data:', error);
      toast.error('Failed to refresh data');
    }
  };

  const toggleBulkSelection = (key: string) => {
    setSelectedForBulkRetranslation((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectAllUntranslated = () => {
    const untranslatedKeys = paginatedData
      .filter(
        (item) => item.status === 'missing' || item.status === 'untranslated'
      )
      .map((item) => item.key);
    setSelectedForBulkRetranslation(
      new Set([...selectedForBulkRetranslation, ...untranslatedKeys])
    );
  };

  const clearSelection = () => {
    setSelectedForBulkRetranslation(new Set());
  };

  const getRowClassName = (item: FlattenedItem) => {
    if (item.status === 'missing')
      return 'bg-destructive/5 border-l-4 border-destructive/50';
    if (item.status === 'untranslated')
      return 'bg-yellow-50 dark:bg-yellow-950/10 border-l-4 border-yellow-500/50';
    return 'bg-card hover:bg-muted/30 transition-colors duration-200';
  };

  const getStatusBadge = (item: FlattenedItem) => {
    switch (item.status) {
      case 'missing':
        return (
          <Badge variant="destructive" className="text-xs">
            Missing
          </Badge>
        );
      case 'untranslated':
        return (
          <Badge variant="secondary" className="text-xs">
            Untranslated
          </Badge>
        );
      case 'translated':
        return (
          <Badge
            variant="default"
            className="text-xs bg-accent text-accent-foreground"
          >
            Translated
          </Badge>
        );
    }
  };

  return (
    <Card className="overflow-hidden shadow-sm">
      {/* Enhanced header with statistics and bulk actions */}
      <div className="border-b border-border p-4 bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <h3 className="font-heading font-bold text-foreground">
                Translation Table
              </h3>
            </div>

            {/* Statistics display */}
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="border-primary/30">
                {sortedData.length} items
              </Badge>
              <Badge variant="outline" className="border-accent/30">
                {sourceLanguage.toUpperCase()} → {targetLanguage.toUpperCase()}
              </Badge>
              <Badge
                variant="outline"
                className="border-green-500/30 text-green-700 cursor-pointer hover:bg-green-50"
                onClick={() => setStatusFilter('translated')}
              >
                {stats.translated} translated
              </Badge>
              <Badge
                variant="outline"
                className="border-yellow-500/30 text-yellow-700 cursor-pointer hover:bg-yellow-50"
                onClick={() => setStatusFilter('untranslated')}
              >
                {stats.untranslated} untranslated
              </Badge>
              {stats.missing > 0 && (
                <Badge
                  variant="outline"
                  className="border-red-500/30 text-red-700 cursor-pointer hover:bg-red-50"
                  onClick={() => setStatusFilter('missing')}
                >
                  {stats.missing} missing
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Refresh Button */}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshLoading}
                className="shadow-sm hover:shadow-md transition-all duration-200"
              >
                {isRefreshLoading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Refresh
              </Button>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search translations..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  resetPagination();
                }}
                className="pl-10 w-64 bg-background border-border/50 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  resetPagination();
                }}
              >
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="untranslated">Untranslated</SelectItem>
                  <SelectItem value="translated">Translated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Page Size */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  resetPagination();
                }}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllUntranslated}
                disabled={
                  paginatedData.filter(
                    (item) =>
                      item.status === 'missing' ||
                      item.status === 'untranslated'
                  ).length === 0
                }
              >
                Select Page Untranslated
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedForBulkRetranslation.size === 0}
              >
                Clear Selection
              </Button>
            </div>
          </div>

          {selectedForBulkRetranslation.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {selectedForBulkRetranslation.size} selected
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={handleBulkRetranslate}
                disabled={isRetranslateLoading}
                className="bg-primary hover:bg-primary/90"
              >
                {isRetranslateLoading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-1" />
                )}
                Retranslate Selected
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-muted/70 to-muted/50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50 w-12">
                Select
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                <button
                  onClick={() => handleSort('key')}
                  className="flex items-center space-x-1 hover:text-foreground transition-colors"
                >
                  <span>Key</span>
                  {getSortIcon('key')}
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                <button
                  onClick={() => handleSort('original')}
                  className="flex items-center space-x-1 hover:text-foreground transition-colors"
                >
                  <span>Original ({sourceLanguage.toUpperCase()})</span>
                  {getSortIcon('original')}
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                <button
                  onClick={() => handleSort('translated')}
                  className="flex items-center space-x-1 hover:text-foreground transition-colors"
                >
                  <span>Translation ({targetLanguage.toUpperCase()})</span>
                  {getSortIcon('translated')}
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border/50">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 hover:text-foreground transition-colors"
                >
                  <span>Status</span>
                  {getSortIcon('status')}
                </button>
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr
                key={item.key}
                className={`border-b border-border/50 ${getRowClassName(item)}`}
              >
                {/* Selection checkbox */}
                <td className="p-4 border-r border-border/30">
                  <input
                    type="checkbox"
                    checked={selectedForBulkRetranslation.has(item.key)}
                    onChange={() => toggleBulkSelection(item.key)}
                    className="w-4 h-4 rounded border-2 border-border/50 text-primary bg-background checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 accent-primary"
                  />
                </td>

                {/* Key */}
                <td className="p-4 border-r border-border/30">
                  <code className="text-sm font-mono bg-muted/50 px-2 py-1 rounded-md text-foreground break-all">
                    {item.key}
                  </code>
                </td>

                {/* Original */}
                <td className="p-4 border-r border-border/30">
                  <div className="max-w-xs">
                    <p className="text-sm text-foreground break-words leading-relaxed">
                      {item.original}
                    </p>
                  </div>
                </td>

                {/* Translation */}
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
                            disabled={isEditLoading}
                            className="h-7 px-3 bg-accent hover:bg-accent/90"
                          >
                            {isEditLoading ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3 mr-1" />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isEditLoading}
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

                {/* Status */}
                <td className="p-4 border-r border-border/30">
                  {getStatusBadge(item)}
                </td>

                {/* Actions */}
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    {editingKey !== item.key && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item.key, item.translated)}
                          disabled={isEditLoading}
                          className="h-8 w-8 p-0 hover:bg-primary/10 hover:border-primary/50"
                        >
                          {isEditLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Edit3 className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetranslate(item.key)}
                          disabled={
                            retranslatingKeys.has(item.key) ||
                            isRetranslateLoading
                          }
                          className="h-8 w-8 p-0 hover:bg-secondary/10 hover:border-secondary/50"
                        >
                          {retranslatingKeys.has(item.key) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
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

        {paginatedData.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h4 className="font-heading font-semibold text-foreground mb-2">
              No translations found
            </h4>
            <p className="text-sm">
              Try adjusting your search terms or filters.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-border p-4 bg-gradient-to-r from-muted/50 to-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startItem} to {endItem} of {sortedData.length} results
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center space-x-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="h-8 w-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      <TranslationContextDialog
        open={contextDialogOpen}
        onOpenChange={(open) => {
          setContextDialogOpen(open);
          if (!open) {
            setPendingRetranslateKeys(null);
          }
        }}
        onConfirm={submitRetranslation}
        onCancel={() => {
          setContextDialogOpen(false);
          setPendingRetranslateKeys(null);
        }}
        title={dialogCopy.title}
        description={dialogCopy.description}
        confirmLabel={dialogCopy.confirmLabel}
        defaultContext={previousContext}
        isSubmitting={isRetranslateLoading}
      />
    </Card>
  );
}
