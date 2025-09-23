// src/lib/constants/languages.ts

export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName?: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
  {
    code: 'fr-CA',
    name: 'French (Quebec)',
    flag: '🇨🇦',
    nativeName: 'Français (Québec)',
  },
  {
    code: 'en-GB',
    name: 'English (United Kingdom)',
    flag: '🇬🇧',
    nativeName: 'English (UK)',
  },
  {
    code: 'vi',
    name: 'Vietnamese',
    flag: '🇻🇳',
    nativeName: 'Tiếng Việt',
  },
];
// Popular languages (first 10) for quick access
export const POPULAR_LANGUAGES = SUPPORTED_LANGUAGES.slice(0, 10);

// Helper functions
export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

export function getLanguageName(code: string): string {
  const language = getLanguageByCode(code);
  return language?.name || code.toUpperCase();
}

export function getLanguageFlag(code: string): string {
  const language = getLanguageByCode(code);
  return language?.flag || '🌐';
}

export function isRTLLanguage(code: string): boolean {
  const language = getLanguageByCode(code);
  return language?.rtl || false;
}

export const LANGUAGE_MAP = new Map(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang])
);

export const LANGUAGE_NAMES_MAP = new Map(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang.name])
);

export const LANGUAGE_FLAGS_MAP = new Map(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang.flag])
);

// Export for backward compatibility and specific use cases
export const ALL_LANGUAGES = SUPPORTED_LANGUAGES;
