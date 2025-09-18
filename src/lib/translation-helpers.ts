// File location: src/lib/translation-helpers.ts

// Helper function to rebuild translated data from cached translations
export function rebuildTranslatedData(
  translations: Array<{ key: string; translatedText: string }>,
  originalData: Record<string, any>
): Record<string, any> | null {
  const translatedMap = new Map(
    translations.map((t) => [t.key, t.translatedText])
  );

  const rebuild = (obj: any, prefix = ''): any => {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return obj;
    }
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[key] = rebuild(value, fullKey);
      } else {
        result[key] = translatedMap.get(fullKey) || value;
      }
    }
    return result;
  };

  return rebuild(originalData);
}

// Helper function to format time remaining
export function formatTimeRemaining(ms: number | null): string {
  if (!ms) return 'Calculating...';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
