'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { isJsonObject, type JsonObject } from '@/types/json';

interface FileUploadProps {
  onUpload: (data: JsonObject) => void | Promise<void>;
  isLoading?: boolean;
}

export function FileUpload({ onUpload, isLoading = false }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);

      try {
        const text = await file.text();
        const data = JSON.parse(text) as unknown;
        if (!isJsonObject(data)) {
          throw new Error('Parsed JSON is not an object');
        }
        await onUpload(data);
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        toast.error('Invalid JSON file. Please check your file format.');
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    multiple: false,
    disabled: isLoading || isUploading,
  });

  const isProcessing = isLoading || isUploading;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          ${
            isDragActive
              ? 'border-primary bg-primary/5 scale-105'
              : isProcessing
              ? 'border-muted-foreground/30 bg-muted/20 cursor-not-allowed'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="p-12 text-center space-y-6">
          {/* Enhanced upload icon with gradient background */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-xl"></div>
            <div
              className={`
              relative w-full h-full bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg
              ${isProcessing ? 'opacity-50' : ''}
            `}
            >
              {isProcessing ? (
                <div className="w-10 h-10 border-4 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
              ) : (
                <svg
                  className="w-10 h-10 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Enhanced typography and messaging */}
          <div className="space-y-3">
            <h3 className="text-2xl font-heading font-bold text-foreground">
              {isProcessing
                ? 'Processing...'
                : isDragActive
                ? 'Drop your JSON file here'
                : 'Upload JSON File'}
            </h3>
            <p
              className={`text-lg ${
                isProcessing
                  ? 'text-muted-foreground/60'
                  : 'text-muted-foreground'
              }`}
            >
              {isProcessing
                ? isLoading
                  ? 'Creating your project...'
                  : 'Reading your file...'
                : isDragActive
                ? 'Release to upload your translation file'
                : 'Drag & drop your JSON file here, or click to browse'}
            </p>
          </div>

          {/* Enhanced file format info */}
          <div
            className={`
            flex items-center justify-center space-x-4 text-sm 
            ${
              isProcessing
                ? 'text-muted-foreground/60'
                : 'text-muted-foreground'
            }
          `}
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>JSON format only</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Max 10MB</span>
            </div>
          </div>

          {/* Enhanced call-to-action button */}
          <Button
            size="lg"
            disabled={isProcessing}
            className="mt-6 px-8 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                <span>
                  {isLoading ? 'Creating Project...' : 'Processing...'}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg
                  className="w-5 h-5"
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
                <span>Choose File</span>
              </div>
            )}
          </Button>
        </div>

        {/* Animated background elements */}
        <div
          className={`
          absolute top-4 right-4 w-8 h-8 bg-primary/10 rounded-full 
          ${isProcessing ? 'opacity-30' : 'animate-pulse'}
        `}
        ></div>
        <div
          className={`
          absolute bottom-4 left-4 w-6 h-6 bg-secondary/10 rounded-full 
          ${isProcessing ? 'opacity-30' : 'animate-pulse delay-1000'}
        `}
        ></div>
      </div>
    </Card>
  );
}
