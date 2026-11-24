import type { EngineKind, Track } from "@/types";

/** Eventos que todo motor reporta ao PlayerController. */
export interface EngineEvents {
  onPlayState: (playing: boolean) => void;
  onBuffering: (buffering: boolean) => void;
  onDuration: (ms: number) => void;
  onEnded: () => void;
  /** `skip: true` = a faixa é impossível de tocar; o controller pula para a próxima. */
  onError: (message: string, opts?: { skip?: boolean }) => void;
}

/**
 * Contrato comum para Spotify Web Playback SDK, preview <audio> e YouTube IFrame.
 * O PlayerController só conversa com esta interface.
 */
export interface PlaybackEngine {
  readonly kind: EngineKind;
  /** Carrega a faixa e começa a tocar. */
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(ms: number): Promise<void>;
  /** 0..1 */
  setVolume(volume: number): void;
  getPosition(): Promise<number>;
  getDuration(): number;
  /** Para e descarta a faixa atual (usado ao trocar de motor). */
  stop(): void;
}
