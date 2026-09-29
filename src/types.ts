export interface Track {
  id: string;
  rank: number;
  artist: string;
  track: string;
  note_tr: string;
  note_en: string;
  source: string;
  /** Media Enricher (iTunes Search API); null when no match was found */
  artwork_url?: string | null;
  preview_url?: string | null;
  apple_music_url?: string | null;
}

export interface TrendsData {
  last_updated: string;
  global_trends: Track[];
  turkey_trends: Track[];
}

export type LikesMap = Record<string, number>;
