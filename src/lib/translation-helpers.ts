// File location: src/lib/translation-helpers.ts

import { isJsonObject, type JsonObject, type JsonValue } from '@/types/json';

// Helper function to rebuild translated data from cached translations
export function rebuildTranslatedData(
  translations: Array<{ key: string; translatedText: string }>,
  originalData: JsonObject
): JsonObject | null {
  const translatedMap = new Map(
    translations.map((t) => [t.key, t.translatedText])
  );

  const rebuild = (obj: JsonValue, prefix = ''): JsonValue => {
    if (!isJsonObject(obj)) {
      return obj;
    }

    const result: JsonObject = {};
    for (const [key, value] of Object.entries(obj) as Array<[
      string,
      JsonValue,
    ]>) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (isJsonObject(value)) {
        result[key] = rebuild(value, fullKey);
      } else {
        result[key] = translatedMap.get(fullKey) ?? value;
      }
    }

    return result;
  };

  const rebuilt = rebuild(originalData);
  return isJsonObject(rebuilt) ? rebuilt : null;
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
