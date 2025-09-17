'use client';

import convex from '@/convex/client';
import { ConvexProvider } from 'convex/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
