'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/react-query-client';
import { ProjectProvider } from '@/context/project-context';
import { TranslationProvider } from '@/context/translation-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <TranslationProvider>{children}</TranslationProvider>
      </ProjectProvider>
      <ReactQueryDevtools initialIsOpen={false} position="left" />
    </QueryClientProvider>
  );
}
