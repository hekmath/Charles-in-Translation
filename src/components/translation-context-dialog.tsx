'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TranslationContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { context?: string; cacheOption?: string }) => void;
  onCancel?: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultContext?: string;
  isSubmitting?: boolean;
  cacheOptions?: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  selectedCacheOption?: string;
  onCacheOptionChange?: (value: string) => void;
}

export function TranslationContextDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Start translation',
  cancelLabel = 'Cancel',
  defaultContext = '',
  isSubmitting = false,
  cacheOptions,
  selectedCacheOption,
  onCacheOptionChange,
}: TranslationContextDialogProps) {
  const [contextValue, setContextValue] = useState(defaultContext);
  const maxLength = 2000;

  useEffect(() => {
    if (open) {
      setContextValue(defaultContext);
    }
  }, [open, defaultContext]);

  const handleConfirm = () => {
    const trimmed = contextValue.trim();
    onConfirm({
      context: trimmed.length > 0 ? trimmed : undefined,
      cacheOption: selectedCacheOption,
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {cacheOptions && cacheOptions.length > 0 && (
            <div className="grid gap-2 text-left">
              <Label htmlFor="cache-project">Translation memory</Label>
              <Select
                value={selectedCacheOption ?? 'none'}
                onValueChange={(value) => onCacheOptionChange?.(value)}
              >
                <SelectTrigger id="cache-project">
                  <SelectValue placeholder="Select cache source" />
                </SelectTrigger>
                <SelectContent>
                  {cacheOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="translation-context">Context (optional)</Label>
            <Textarea
              id="translation-context"
              value={contextValue}
              onChange={(event) => setContextValue(event.target.value)}
              placeholder="Share product details, tone, glossary preferences, or any nuances the translator should consider."
              maxLength={maxLength}
              rows={6}
              className="min-h-[140px]"
            />
            <div className="text-xs text-muted-foreground justify-self-end">
              {contextValue.length}/{maxLength} characters
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Starting…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
