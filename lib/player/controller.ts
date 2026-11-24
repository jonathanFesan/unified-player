/**
 * PlayerController — abstrai os três motores de reprodução atrás de uma única API.
 *
 *   faixa YouTube ............................→ YouTubeEngine (IFrame)
 *   faixa Spotify + conta Premium ............→ SpotifyEngine (Web Playback SDK)
 *   faixa Spotify + Free/sem login + preview →  PreviewEngine (<audio> 30s)
 *   faixa Spotify + Free/sem login sem preview → YouTubeEngine com o vídeo equivalente
 *
 * Fluxo: o store incrementa `loadId` → o controller carrega a faixa atual no motor
 * certo, pausando o anterior. Eventos dos motores voltam para o store.
 */
import { isYouTubeConfigured } from "@/lib/env";
import { PreviewEngine } from "@/lib/player/preview-engine";
import { SpotifyEngine, SpotifySdkUnavailableError } from "@/lib/player/spotify-engine";
import type { EngineEvents, PlaybackEngine } from "@/lib/player/types";
import { YouTubeEngine } from "@/lib/player/youtube-engine";
import { useAuthStore } from "@/lib/store/auth-store";
import { selectCurrentTrack, usePlayerStore } from "@/lib/store/player-store";
import { findYouTubeEquivalent } from "@/lib/youtube/api";
import type { EngineKind, QueueItem, Track } from "@/types";

const store = usePlayerStore;

class PlayerController {
  private spotify: SpotifyEngine;
  private preview: PreviewEngine;
  private youtube: YouTubeEngine;

  private active: PlaybackEngine | null = null;
  /** queueId da faixa efetivamente carregada no motor ativo */
  private loadedQueueId: string | null = null;
  /** Invalida carregamentos assíncronos antigos quando o usuário troca rápido de faixa */
  private loadSeq = 0;
  private youtubeEquivalents = new Map<string, Track | null>();
  private initialized = false;
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.spotify = new SpotifyEngine(this.eventsFor("spotify-sdk"), {
      onReadyChange: (ready) => useAuthStore.getState().setSdkReady(ready),
      onNotPremium: () => useAuthStore.getState().markNotPremium(),
    });
    this.preview = new PreviewEngine(this.eventsFor("spotify-preview"));
    this.youtube = new YouTubeEngine(this.eventsFor("youtube"));
  }

  /** Eventos ignorados se o motor que os emitiu não for o ativo. */
  private eventsFor(kind: EngineKind): EngineEvents {
    const isActive = () => this.active?.kind === kind;
    return {
      onPlayState: (isPlaying) => isActive() && store.getState().setPlayback({ isPlaying }),
      onBuffering: (isBuffering) => isActive() && store.getState().setPlayback({ isBuffering }),
      onDuration: (ms) => isActive() && ms > 0 && store.getState().setPlayback({ durationMs: ms }),
      onEnded: () => isActive() && this.handleEnded(),
      onError: (message, opts) => {
        if (!isActive()) return;
        store.getState().setError(message);
        store.getState().setPlayback({ isPlaying: false, isBuffering: false });
        if (opts?.skip) setTimeout(() => store.getState().next({ auto: true }), 1500);
      },
    };
  }

  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    store.subscribe((s, prev) => {
      if (s.loadId !== prev.loadId) void this.onLoadRequested();
      if (s.volume !== prev.volume || s.muted !== prev.muted) this.applyVolume();
    });
    useAuthStore.subscribe((s, prev) => {
      if (prev.status === "authenticated" && s.status !== "authenticated") this.onSpotifyLogout();
    });

    this.applyVolume();
    this.ticker = setInterval(() => void this.tick(), 500);
  }

  /** Pré-conecta o SDK do Spotify para que o primeiro play seja instantâneo. */
  warmUpSpotify() {
    this.spotify.init().catch(() => {
      /* fallback tratado no load */
    });
  }

  // ------------------------------------------------------------------ carregamento

  private async onLoadRequested() {
    const s = store.getState();
    const track = selectCurrentTrack(s);
    const seq = ++this.loadSeq;

    if (!track || !s.autoplay) {
      this.stopActive();
      store.getState().setPlayback({
        isPlaying: false,
        isBuffering: false,
        positionMs: 0,
        durationMs: track?.durationMs ?? 0,
      });
      return;
    }
    await this.loadTrack(track, seq);
  }

  private async loadTrack(track: QueueItem, seq: number) {
    // Deve rodar sincronamente dentro do gesto do usuário (políticas de autoplay)
    this.spotify.prime();
    this.stopActive();

    const { setPlayback, setError, setNotice } = store.getState();
    setPlayback({ positionMs: 0, durationMs: track.durationMs, isBuffering: true, isPlaying: false });
    setError(null);
    setNotice(null);

    try {
      const { engine, playable, notice } = await this.resolve(track);
      if (seq !== this.loadSeq) return;

      this.active = engine;
      setPlayback({ engine: engine.kind });
      if (notice) setNotice(notice);
      this.applyVolume();

      await engine.load(playable);
      if (seq !== this.loadSeq) return;
      this.loadedQueueId = track.queueId;
    } catch (e) {
      if (seq !== this.loadSeq) return;
      // Spotify SDK indisponível (não-Premium, navegador incompatível...) → tenta fallback
      if (e instanceof SpotifySdkUnavailableError && track.source === "spotify") {
        if (e.notPremium) useAuthStore.getState().markNotPremium();
        try {
          const fb = await this.resolveSpotifyFallback(track, e.message);
          if (seq !== this.loadSeq) return;
          this.active = fb.engine;
          setPlayback({ engine: fb.engine.kind });
          setNotice(fb.notice ?? null);
          this.applyVolume();
          await fb.engine.load(fb.playable);
          if (seq === this.loadSeq) this.loadedQueueId = track.queueId;
          return;
        } catch (inner) {
          e = inner;
        }
      }
      if (seq !== this.loadSeq) return;
      this.loadedQueueId = null;
      setPlayback({ isPlaying: false, isBuffering: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  private async resolve(track: Track): Promise<{ engine: PlaybackEngine; playable: Track; notice?: string }> {
    if (track.source === "youtube") return { engine: this.youtube, playable: track };

    const auth = useAuthStore.getState();
    if (auth.status === "authenticated" && auth.isPremium) return { engine: this.spotify, playable: track };

    return this.resolveSpotifyFallback(track);
  }

  private async resolveSpotifyFallback(track: Track, reason?: string) {
    const auth = useAuthStore.getState();
    const why = reason ?? (auth.status === "authenticated" ? "Conta Spotify Free" : "Spotify não conectado");

    if (track.previewUrl) {
      return { engine: this.preview as PlaybackEngine, playable: track, notice: `${why} — tocando prévia de 30s.` };
    }
    if (!isYouTubeConfigured()) {
      throw new Error(`${why} e esta faixa não tem prévia. Configure a chave do YouTube para usar o fallback.`);
    }
    let eq = this.youtubeEquivalents.get(track.id);
    if (eq === undefined) {
      eq = await findYouTubeEquivalent(track);
      this.youtubeEquivalents.set(track.id, eq);
    }
    if (!eq) throw new Error(`${why}: nenhuma versão equivalente encontrada no YouTube.`);
    return {
      engine: this.youtube as PlaybackEngine,
      playable: eq,
      notice: `${why} — tocando versão do YouTube.`,
    };
  }

  private stopActive() {
    this.active?.stop();
    this.active = null;
    this.loadedQueueId = null;
    store.getState().setPlayback({ engine: null });
  }

  // ------------------------------------------------------------------ controles

  togglePlay() {
    const s = store.getState();
    const track = selectCurrentTrack(s);
    if (!track) {
      if (s.queue.length) s.playAt(0);
      return;
    }
    // Faixa restaurada do localStorage ou que falhou: carrega agora
    if (!this.active || this.loadedQueueId !== track.queueId) {
      usePlayerStore.setState({ autoplay: true });
      void this.loadTrack(track, ++this.loadSeq);
      return;
    }
    this.spotify.prime();
    if (s.isPlaying) {
      s.setPlayback({ isPlaying: false });
      void this.active.pause();
    } else {
      s.setPlayback({ isPlaying: true });
      void this.active.play();
    }
  }

  seek(ms: number) {
    store.getState().setPlayback({ positionMs: ms });
    void this.active?.seek(ms);
  }

  next() {
    store.getState().next();
  }

  previous() {
    const s = store.getState();
    // Comportamento padrão: após 3s, "anterior" volta ao início da faixa
    if (this.active && s.positionMs > 3000) this.seek(0);
    else s.previous();
  }

  private handleEnded() {
    const s = store.getState();
    if (s.repeat === "one" && this.active) {
      const track = selectCurrentTrack(s);
      if (this.active.kind === "spotify-sdk" && track) {
        // o SDK "esquece" a faixa ao terminar; recarrega
        void this.loadTrack(track, ++this.loadSeq);
      } else {
        void this.active.seek(0).then(() => this.active?.play());
      }
      return;
    }
    s.next({ auto: true });
  }

  private applyVolume() {
    const { volume, muted } = store.getState();
    const v = muted ? 0 : volume;
    this.spotify.setVolume(v);
    this.preview.setVolume(v);
    this.youtube.setVolume(v);
  }

  private async tick() {
    const s = store.getState();
    if (!this.active || !s.isPlaying) return;
    const engine = this.active;
    const pos = await engine.getPosition();
    if (engine !== this.active) return;
    const dur = engine.getDuration() || s.durationMs;
    store.getState().setPlayback({ positionMs: dur ? Math.min(pos, dur) : pos, durationMs: dur });
  }

  private onSpotifyLogout() {
    if (this.active?.kind === "spotify-sdk") {
      this.stopActive();
      store.getState().setPlayback({ isPlaying: false });
    }
    this.spotify.destroy();
  }
}

/** Singleton — há um único player de áudio por aba. */
export const playerController = new PlayerController();
