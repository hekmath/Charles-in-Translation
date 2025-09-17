'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  SUPPORTED_LANGUAGES,
  POPULAR_LANGUAGES,
  getLanguageByCode,
  type Language,
} from '@/lib/constants/languages';

interface LanguageSelectorProps {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (language: string) => void;
  onTargetChange: (language: string) => void;
}

export function LanguageSelector({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
}: LanguageSelectorProps) {
  const getLanguageInfo = (code: string): Language => {
    return (
      getLanguageByCode(code) || {
        code,
        name: code.toUpperCase(),
        flag: '🌐',
      }
    );
  };

  // Get additional languages (not in popular list)
  const additionalLanguages = SUPPORTED_LANGUAGES.slice(
    POPULAR_LANGUAGES.length
  );

  const LanguageDropdown = ({
    value,
    onChange,
    placeholder,
    variant = 'default',
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    variant?: 'default' | 'secondary';
  }) => {
    const selectedLang = getLanguageInfo(value);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant === 'secondary' ? 'secondary' : 'outline'}
            className={`
              min-w-[140px] justify-between font-medium shadow-sm hover:shadow-md transition-all duration-200
              ${
                variant === 'secondary'
                  ? 'bg-secondary/10 hover:bg-secondary/20 border-secondary/20'
                  : ''
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">{selectedLang.flag}</span>
              <span className="font-medium">
                {value ? selectedLang.name : placeholder}
              </span>
            </div>
            <svg
              className="w-4 h-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Popular Languages
          </DropdownMenuLabel>
          {POPULAR_LANGUAGES.map((language) => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => onChange(language.code)}
              className={`
                flex items-center justify-between cursor-pointer py-2.5 px-3
                ${
                  value === language.code
                    ? 'bg-primary/10 text-primary font-medium'
                    : ''
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{language.flag}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{language.name}</span>
                  {language.nativeName &&
                    language.nativeName !== language.name && (
                      <span className="text-xs text-muted-foreground">
                        {language.nativeName}
                      </span>
                    )}
                </div>
              </div>
              {language.rtl && (
                <Badge variant="secondary" className="text-xs">
                  RTL
                </Badge>
              )}
            </DropdownMenuItem>
          ))}

          {additionalLanguages.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Other Languages
              </DropdownMenuLabel>
              {additionalLanguages.map((language) => (
                <DropdownMenuItem
                  key={language.code}
                  onClick={() => onChange(language.code)}
                  className={`
                    flex items-center justify-between cursor-pointer py-2.5 px-3
                    ${
                      value === language.code
                        ? 'bg-primary/10 text-primary font-medium'
                        : ''
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{language.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{language.name}</span>
                      {language.nativeName &&
                        language.nativeName !== language.name && (
                          <span className="text-xs text-muted-foreground">
                            {language.nativeName}
                          </span>
                        )}
                    </div>
                  </div>
                  {language.rtl && (
                    <Badge variant="secondary" className="text-xs">
                      RTL
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-muted-foreground">From:</span>
        <LanguageDropdown
          value={sourceLanguage}
          onChange={onSourceChange}
          placeholder="Source"
        />
      </div>

      <div className="flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center shadow-sm">
          <svg
            className="w-4 h-4 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-muted-foreground">To:</span>
        <LanguageDropdown
          value={targetLanguage}
          onChange={onTargetChange}
          placeholder="Target"
          variant="secondary"
        />
      </div>
    </div>
  );
}
