import { useI18n } from '../i18n';
import type { Track } from '../types';

interface Props {
  track: Track;
  likes: number;
  liked: boolean;
  onLike: (track: Track) => void;
}

export function TrackRow({ track, likes, liked, onLike }: Props) {
  const { t, lang, locale } = useI18n();
  const note = lang === 'tr' ? track.note_tr : track.note_en;
  const top3 = track.rank <= 3;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`w-7 shrink-0 text-center text-sm font-extrabold tabular-nums ${
            top3 ? 'text-rose-500' : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          {track.rank}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{track.track}</p>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{track.artist}</p>
          {note && <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">{note}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onLike(track)}
        disabled={liked}
        aria-pressed={liked}
        aria-label={`${liked ? t('track.liked') : t('track.like')}: ${track.artist} – ${track.track}`}
        title={liked ? t('track.liked') : t('track.like')}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition active:scale-95 ${
          liked
            ? 'cursor-default border-rose-500 bg-rose-500 text-white'
            : 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/50'
        }`}
      >
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span className="text-xs font-semibold tabular-nums">{new Intl.NumberFormat(locale).format(likes)}</span>
      </button>
    </li>
  );
}
