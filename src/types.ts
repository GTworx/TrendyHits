export interface Track {
  id: string;
  rank: number;
  artist: string;
  track: string;
  note_tr: string;
  note_en: string;
  source: string;
}

export interface TrendsData {
  last_updated: string;
  global_trends: Track[];
  turkey_trends: Track[];
}

export type LikesMap = Record<string, number>;
