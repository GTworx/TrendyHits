import { LANGS, useI18n } from '../i18n';

export function LanguageSwitcher() {
  const { t, lang, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('lang.switch')}
      className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== lang && setLang(l)}
          aria-pressed={l === lang}
          title={t(l === 'tr' ? 'lang.tr' : 'lang.en')}
          className={`rounded-full px-3 py-1.5 uppercase transition ${
            l === lang
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
