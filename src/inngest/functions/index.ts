// inngest/functions/index.ts - Export all Inngest functions
import { coordinateTranslation } from './translation-coordinator';
import {
  processTranslationChunk,
  handleTranslationCompletion,
} from './translation-chunk-worker';

// Export all functions for registration
export {
  // New coordinated workflow functions
  coordinateTranslation,
  processTranslationChunk,
  handleTranslationCompletion,
};

// Export all functions as an array for easier registration
export const allFunctions = [
  coordinateTranslation,
  processTranslationChunk,
  handleTranslationCompletion,
];

// Function metadata for debugging/monitoring
export const functionMetadata = {
  coordinateTranslation: {
    id: 'coordinate-translation',
    description: 'Main orchestrator for translation jobs',
    triggers: ['translation/coordinate'],
    concurrency: 5,
    timeout: '30m',
  },
  processTranslationChunk: {
    id: 'process-translation-chunk',
    description: 'Processes individual translation chunks in parallel',
    triggers: ['translation/process-chunk'],
    concurrency: 20,
    timeout: '10m',
  },
  handleTranslationCompletion: {
    id: 'handle-translation-completion',
    description: 'Handles completion events and cleanup',
    triggers: ['translation/job-completed'],
    concurrency: 10,
    timeout: '5m',
  },
} as const;
