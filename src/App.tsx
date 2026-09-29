import { useCallback, useEffect, useState } from 'react';
import { useI18n } from './i18n';
import type { LikesMap, Track, TrendsData } from './types';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { TrendColumn } from './components/TrendColumn';
import { NewsletterForm } from './components/NewsletterForm';

const LIKED_KEY = 'trendyhits.liked';
const SOURCES = ['Spotify', 'Billboard', 'Apple Music', 'YouTube Music'];

function readLiked(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LIKED_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function writeLiked(ids: Set<string>) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable */
  }
}

export function App() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<TrendsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [likes, setLikes] = useState<LikesMap>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(readLiked);
  const [likeError, setLikeError] = useState(false);

  useEffect(() => {
    fetch('/data/trends.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setLoadError(true));
    fetch('/api/likes')
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: LikesMap) => setLikes((prev) => ({ ...m, ...prev })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!likeError) return;
    const id = setTimeout(() => setLikeError(false), 4000);
    return () => clearTimeout(id);
  }, [likeError]);

  const onLike = useCallback(
    async (track: Track) => {
      if (likedIds.has(track.id)) return;
      const markLiked = (on: boolean) =>
        setLikedIds((prev) => {
          const next = new Set(prev);
          on ? next.add(track.id) : next.delete(track.id);
          writeLiked(next);
          return next;
        });

      // Optimistic update, rolled back on failure
      markLiked(true);
      setLikes((m) => ({ ...m, [track.id]: (m[track.id] ?? 0) + 1 }));
      try {
        const res = await fetch('/api/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: track.id }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { likes_count } = await res.json();
        setLikes((m) => ({ ...m, [track.id]: likes_count }));
      } catch {
        markLiked(false);
        setLikes((m) => ({ ...m, [track.id]: Math.max(0, (m[track.id] ?? 1) - 1) }));
        setLikeError(true);
      }
    },
    [likedIds],
  );

  const updated = data
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.last_updated))
    : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-zinc-50/85 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xl font-extrabold tracking-tight">
              <span aria-hidden="true">🎧 </span>
              <span className="bg-gradient-to-r from-rose-500 to-indigo-500 bg-clip-text text-transparent">
                {t('app.title')}
              </span>
            </p>
            {updated && (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {t('header.lastUpdated')}: <time dateTime={data!.last_updated}>{updated}</time>
              </p>
            )}
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{t('app.tagline')}</h1>

        {loadError && (
          <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {t('state.error')}
          </p>
        )}
        {!data && !loadError && <p className="mt-6 animate-pulse text-zinc-500">{t('state.loading')}</p>}

        {data && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TrendColumn
              title={t('lists.global')}
              subtitle={t('lists.globalSubtitle')}
              tracks={data.global_trends}
              likes={likes}
              likedIds={likedIds}
              onLike={onLike}
            />
            <TrendColumn
              title={t('lists.turkey')}
              subtitle={t('lists.turkeySubtitle')}
              tracks={data.turkey_trends}
              likes={likes}
              likedIds={likedIds}
              onLike={onLike}
            />
          </div>
        )}

        <div className="mt-10">
          <NewsletterForm />
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
          <div>
            <p>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{t('footer.sources')}:</span>{' '}
              {SOURCES.join(' · ')}
            </p>
            <p className="mt-1 text-xs">{t('footer.note')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">{t('footer.language')}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>

      {likeError && (
        <div role="alert" className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-sm rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">
          {t('state.likeError')}
        </div>
      )}
    </div>
  );
}
