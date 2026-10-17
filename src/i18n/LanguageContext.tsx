import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Language } from '@/types';
import { translate, type TranslationKey } from '@/i18n/translations';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'pulsebridge_lang';

export function LanguageProvider({ children, initialLang }: { children: ReactNode; initialLang?: Language }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (initialLang) return initialLang;
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored === 'en' || stored === 'hi') return stored;
    } catch {
      // Fallback if localStorage is inaccessible
    }
    return 'en';
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newLang);
        document.documentElement.lang = newLang;
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === 'hi' ? 'en' : 'hi';
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, next);
          document.documentElement.lang = next;
        }
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(key, lang, params),
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

