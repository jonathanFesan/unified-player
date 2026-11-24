export type TrackSource = "spotify" | "youtube";

/** Representação normalizada de uma faixa, independente da origem. */
export interface Track {
  /** ID único global: `spotify:<id>` ou `youtube:<videoId>` */
  id: string;
  source: TrackSource;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  /** Duração em ms (0 quando desconhecida) */
  durationMs: number;
  /** Spotify: URI `spotify:track:...` usada pelo Web Playback SDK */
  spotifyUri?: string;
  /** Spotify: URL do preview de 30s (pode ser null — depreciado pelo Spotify em apps novos) */
  previewUrl?: string | null;
  /** YouTube: ID do vídeo */
  videoId?: string;
  /** Link externo para abrir no app de origem */
  externalUrl?: string;
}

/** Um item da fila. O mesmo Track pode aparecer mais de uma vez, por isso o queueId. */
export interface QueueItem extends Track {
  queueId: string;
}

export type RepeatMode = "off" | "all" | "one";

/** Qual motor está tocando o item atual. */
export type EngineKind = "spotify-sdk" | "spotify-preview" | "youtube";

export interface SpotifyUser {
  id: string;
  displayName: string;
  avatar?: string;
  product: "premium" | "free" | "open" | string;
}

export type SearchStatus = "idle" | "loading" | "success" | "error";

export interface SourceSearchState {
  status: SearchStatus;
  results: Track[];
  error?: string;
}
