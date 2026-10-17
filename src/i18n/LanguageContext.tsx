import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Language } from '@/types';
import { translate, type TranslationKey } from '@/i18n/translations';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children, initialLang = 'hi' }: { children: ReactNode; initialLang?: Language }) {
  const [lang, setLang] = useState<Language>(initialLang);

  const toggle = useCallback(() => {
    setLang((prev) => (prev === 'hi' ? 'en' : 'hi'));
  }, []);

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
