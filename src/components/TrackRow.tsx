import { useI18n } from '../i18n';
import type { Track } from '../types';

interface Props {
  track: Track;
  likes: number;
  liked: boolean;
  onLike: (track: Track) => void;
  playing: boolean;
  progress: number;
  onTogglePlay: (track: Track) => void;
}

function Artwork({ track, playing, progress, onTogglePlay }: Pick<Props, 'track' | 'playing' | 'progress' | 'onTogglePlay'>) {
  const { t } = useI18n();
  const img = track.artwork_url ? (
    <img src={track.artwork_url} alt="" loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 object-cover" />
  ) : (
    <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-rose-400 to-indigo-500 text-lg font-extrabold text-white">
      {track.track.charAt(0).toUpperCase()}
    </span>
  );

  if (!track.preview_url) {
    return <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-sm">{img}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onTogglePlay(track)}
      aria-pressed={playing}
      aria-label={`${playing ? t('track.pause') : t('track.play')}: ${track.artist} – ${track.track}`}
      title={playing ? t('track.pause') : t('track.play')}
      className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
    >
      {img}
      <span
        className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition ${
          playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
        }`}
      >
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.14v13.72L19 12 8 5.14z" />}
        </svg>
      </span>
      {playing && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <span className="block h-full bg-rose-500 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </button>
  );
}

export function TrackRow({ track, likes, liked, onLike, playing, progress, onTogglePlay }: Props) {
  const { t, lang, locale } = useI18n();
  const note = lang === 'tr' ? track.note_tr : track.note_en;
  const top3 = track.rank <= 3;

  return (
    <li
      className={`flex items-center justify-between gap-3 px-4 py-3 transition ${
        playing ? 'bg-rose-50/70 dark:bg-rose-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`w-6 shrink-0 text-center text-sm font-extrabold tabular-nums ${
            top3 ? 'text-rose-500' : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          {track.rank}
        </span>
        <Artwork track={track} playing={playing} progress={progress} onTogglePlay={onTogglePlay} />
        <div className="min-w-0">
          {track.apple_music_url ? (
            <a
              href={track.apple_music_url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('track.openApple')}
              className="block truncate font-semibold text-zinc-900 hover:text-rose-600 hover:underline dark:text-zinc-100 dark:hover:text-rose-400"
            >
              {track.track}
            </a>
          ) : (
            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{track.track}</p>
          )}
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
