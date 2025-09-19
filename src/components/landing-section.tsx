// File location: src/components/landing-section.tsx

'use client';

import { FileUpload } from '@/components/file-upload';
import type { JsonObject } from '@/types/json';

interface LandingSectionProps {
  onUpload: (data: JsonObject) => Promise<void>;
  isLoading: boolean;
}

export function LandingSection({ onUpload, isLoading }: LandingSectionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl scale-150"></div>
        <div className="relative bg-card border border-border/50 rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg
              className="w-8 h-8 text-primary-foreground"
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
          </div>
          <h2 className="text-3xl font-heading font-black text-foreground mb-4 text-balance">
            Start Your Translation Journey
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto text-pretty">
            Upload your JSON files and let AI handle the heavy lifting.
            Professional localization made simple.
          </p>
          <FileUpload onUpload={onUpload} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6 text-primary"
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
          </div>
          <h3 className="font-heading font-bold text-foreground">
            Lightning Fast
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-powered translations in seconds
          </p>
        </div>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6 text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-foreground">
            Quality Assured
          </h3>
          <p className="text-sm text-muted-foreground">
            Professional-grade accuracy
          </p>
        </div>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
              />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-foreground">
            Full Control
          </h3>
          <p className="text-sm text-muted-foreground">
            Edit and refine every translation
          </p>
        </div>
      </div>
    </div>
  );
}
