import { isJsonObject, type JsonObject, type JsonValue } from '@/types/json';

export interface ExtractedJsonKeys {
  allKeys: string[];
  translatableKeys: string[];
}

export function collectJsonKeys(
  value: JsonValue,
  prefix = ''
): ExtractedJsonKeys {
  const allKeys: string[] = [];
  const translatableKeys: string[] = [];

  if (isJsonObject(value)) {
    for (const [key, entryValue] of Object.entries(value) as Array<[
      string,
      JsonValue,
    ]>) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      allKeys.push(fullKey);

      if (isJsonObject(entryValue)) {
        const nested = collectJsonKeys(entryValue, fullKey);
        allKeys.push(...nested.allKeys);
        translatableKeys.push(...nested.translatableKeys);
      } else {
        translatableKeys.push(fullKey);
      }
    }
  }

  return { allKeys, translatableKeys };
}

export function flattenJson(
  obj: JsonObject,
  prefix = ''
): Record<string, string> {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj) as Array<[string, JsonValue]>) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (isJsonObject(value)) {
      Object.assign(flattened, flattenJson(value, fullKey));
    } else {
      flattened[fullKey] = String(value);
    }
  }

  return flattened;
}

export function countJsonLeaves(value: JsonValue): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((acc, item) => acc + countJsonLeaves(item), 0);
  }

  if (isJsonObject(value)) {
    return Object.values(value).reduce<number>(
      (acc, nested) => acc + countJsonLeaves(nested),
      0
    );
  }

  return 1;
}
