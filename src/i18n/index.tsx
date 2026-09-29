import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import tr from './tr.json';
import en from './en.json';

export type Lang = 'tr' | 'en';
export type TranslationKey = keyof typeof en;

export const LANGS: Lang[] = ['tr', 'en'];
const dictionaries: Record<Lang, Record<TranslationKey, string>> = { tr, en };
const LOCALES: Record<Lang, string> = { tr: 'tr-TR', en: 'en-US' };
const STORAGE_KEY = 'trendyhits.lang';

export function langFromPath(pathname: string): Lang | null {
  const seg = pathname.split('/')[1];
  return seg === 'tr' || seg === 'en' ? seg : null;
}

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'tr' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

function storeLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

/** Used only when the URL has no language prefix (e.g. `vite` dev without Netlify redirects). */
export function detectLang(): Lang {
  return readStoredLang() ?? (navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en');
}

function applyDocumentMeta(lang: Lang) {
  const dict = dictionaries[lang];
  document.documentElement.lang = lang;
  document.title = `${dict['app.title']} · ${dict['app.tagline']}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', dict['app.metaDescription']);
  const origin = window.location.origin;
  document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]').forEach((link) => {
    const h = link.hreflang;
    link.href = `${origin}/${h === 'x-default' ? '' : `${h}/`}`;
  });
}

interface I18nValue {
  lang: Lang;
  locale: string;
  t: (key: TranslationKey) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    applyDocumentMeta(lang);
    storeLang(lang);
  }, [lang]);

  useEffect(() => {
    const onPop = () => {
      const fromUrl = langFromPath(window.location.pathname);
      if (fromUrl) setLangState(fromUrl);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setLang = useCallback((next: Lang) => {
    const rest = window.location.pathname.replace(/^\/(tr|en)(?=\/|$)/, '');
    window.history.pushState(null, '', `/${next}${rest || '/'}${window.location.search}${window.location.hash}`);
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      locale: LOCALES[lang],
      t: (key) => dictionaries[lang][key] ?? key,
      setLang,
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
