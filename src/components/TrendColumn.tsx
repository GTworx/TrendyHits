import { useI18n } from '../i18n';
import type { LikesMap, Track } from '../types';
import { TrackRow } from './TrackRow';

interface Props {
  title: string;
  subtitle: string;
  tracks: Track[];
  likes: LikesMap;
  likedIds: Set<string>;
  onLike: (track: Track) => void;
}

export function TrendColumn({ title, subtitle, tracks, likes, likedIds, onLike }: Props) {
  const { t } = useI18n();

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-end justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {tracks.length} {t('lists.tracks')}
        </span>
      </header>
      <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            likes={likes[track.id] ?? 0}
            liked={likedIds.has(track.id)}
            onLike={onLike}
          />
        ))}
      </ol>
    </section>
  );
}
