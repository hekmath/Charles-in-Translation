// File location: src/components/project-header.tsx

'use client';

import { useProject } from '@/context/project-context';

export function ProjectHeader() {
  const { currentProject, sourceLanguage, targetLanguage } = useProject();
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-sm">
            <svg
              className="w-6 h-6 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              {currentProject?.name || 'Current Project'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {sourceLanguage.toUpperCase()} →{' '}
              {targetLanguage.toUpperCase() || 'Select target'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
