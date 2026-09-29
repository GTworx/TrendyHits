import { useCallback, useEffect, useRef, useState } from 'react';

/** One shared <audio> for the whole page: starting a preview stops the previous one. */
export function usePreviewPlayer(onError: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onEnd = () => {
      setPlayingId(null);
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = useCallback(
    (id: string, url: string) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (playingId === id) {
        audio.pause();
        setPlayingId(null);
        return;
      }
      audio.pause();
      audio.src = url;
      setProgress(0);
      setPlayingId(id);
      audio.play().catch(() => {
        setPlayingId(null);
        onError();
      });
    },
    [playingId, onError],
  );

  return { playingId, progress, toggle };
}
