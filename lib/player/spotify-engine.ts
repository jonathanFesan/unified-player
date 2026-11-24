/**
 * Motor Spotify — Web Playback SDK (somente contas Premium).
 * Docs: https://developer.spotify.com/documentation/web-playback-sdk
 *
 * O SDK cria um "device" Spotify Connect no navegador. Para tocar uma faixa
 * chamamos a Web API (`PUT /me/player/play?device_id=...`).
 */
import { SpotifyApiError, playUriOnDevice, transferPlayback } from "@/lib/spotify/api";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";
import { loadScript } from "@/lib/utils";
import type { EngineEvents, PlaybackEngine } from "@/lib/player/types";
import type { Track } from "@/types";

/** Erro que indica ao controller para cair no fallback (preview/YouTube). */
export class SpotifySdkUnavailableError extends Error {
  constructor(
    message: string,
    public notPremium = false,
  ) {
    super(message);
    this.name = "SpotifySdkUnavailableError";
  }
}

interface SdkHooks {
  onReadyChange: (ready: boolean) => void;
  onNotPremium: () => void;
}

type TrackWithLink = Spotify.Track & { linked_from?: { uri: string | null } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SpotifySdkUnavailableError(message)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export class SpotifyEngine implements PlaybackEngine {
  readonly kind = "spotify-sdk" as const;
  private player: Spotify.Player | null = null;
  private deviceId: string | null = null;
  private ready: Promise<string> | null = null;
  private volume = 0.8;

  private currentUri: string | null = null;
  private lastState: Spotify.PlaybackState | null = null;
  private lastStateAt = 0;
  private endedFired = false;

  constructor(
    private events: EngineEvents,
    private hooks: SdkHooks,
  ) {}

  /** Carrega o SDK e conecta o device. Resolve com o device_id. */
  init(): Promise<string> {
    if (this.ready) return this.ready;

    this.ready = new Promise<string>((resolve, reject) => {
      const setup = () => {
        const player = new Spotify.Player({
          name: "Unified Player (Web)",
          volume: this.volume,
          getOAuthToken: (cb) => {
            getSpotifyAccessToken().then((token) => token && cb(token));
          },
        });

        player.addListener("ready", ({ device_id }) => {
          this.deviceId = device_id;
          this.hooks.onReadyChange(true);
          resolve(device_id);
        });
        player.addListener("not_ready", () => {
          this.deviceId = null;
          this.hooks.onReadyChange(false);
        });
        player.addListener("initialization_error", ({ message }) =>
          reject(new SpotifySdkUnavailableError(`Navegador não suportado pelo Spotify SDK: ${message}`)),
        );
        player.addListener("authentication_error", ({ message }) =>
          reject(new SpotifySdkUnavailableError(`Falha de autenticação no Spotify SDK: ${message}`)),
        );
        player.addListener("account_error", () => {
          this.hooks.onNotPremium();
          reject(new SpotifySdkUnavailableError("O Web Playback SDK exige Spotify Premium.", true));
        });
        player.addListener("playback_error", ({ message }) => this.events.onError(`Spotify: ${message}`));
        player.addListener("player_state_changed", (s) => this.handleState(s));

        player.connect().then((ok) => {
          if (!ok) reject(new SpotifySdkUnavailableError("Não foi possível conectar o Spotify SDK."));
        });
        this.player = player;
      };

      if (window.Spotify?.Player) {
        setup();
      } else {
        window.onSpotifyWebPlaybackSDKReady = setup;
        loadScript("https://sdk.scdn.co/spotify-player.js").catch(() =>
          reject(new SpotifySdkUnavailableError("Falha ao baixar o Spotify Web Playback SDK.")),
        );
      }
    });

    this.ready.catch(() => this.destroy());
    return this.ready;
  }

  /**
   * Precisa rodar de forma síncrona dentro de um gesto do usuário (click)
   * para liberar o áudio em navegadores móveis / com autoplay restrito.
   */
  prime() {
    void this.player?.activateElement();
  }

  private matches(t: Spotify.Track | null | undefined): boolean {
    if (!t || !this.currentUri) return false;
    return t.uri === this.currentUri || (t as TrackWithLink).linked_from?.uri === this.currentUri;
  }

  private handleState(s: Spotify.PlaybackState | null) {
    if (!s) {
      // Reprodução foi transferida para outro dispositivo
      this.lastState = null;
      this.events.onPlayState(false);
      return;
    }
    const prev = this.lastState;
    this.lastState = s;
    this.lastStateAt = performance.now();

    this.events.onPlayState(!s.paused);
    this.events.onBuffering(s.loading);
    if (s.duration) this.events.onDuration(s.duration);

    // ---- detecção de fim de faixa (o SDK não emite um evento "ended") ----
    if (this.endedFired || !this.currentUri) return;
    const current = s.track_window.current_track;
    const finishedOurs = s.track_window.previous_tracks.some((t) => this.matches(t));
    const movedAway = Boolean(current) && !this.matches(current);
    const stoppedAtEnd =
      s.paused && s.position === 0 && prev && !prev.paused && this.matches(prev.track_window.current_track) &&
      prev.duration - prev.position < 3000;

    if ((finishedOurs && (s.paused || movedAway)) || stoppedAtEnd) {
      this.endedFired = true;
      // Impede o "autoplay/rádio" do Spotify de seguir tocando outra faixa
      if (!s.paused) void this.player?.pause();
      this.events.onEnded();
    }
  }

  async load(track: Track) {
    if (!track.spotifyUri) throw new Error("Faixa do Spotify sem URI.");
    const deviceId = await withTimeout(this.init(), 15000, "O Spotify SDK não ficou pronto a tempo.");

    this.currentUri = track.spotifyUri;
    this.endedFired = false;
    this.lastState = null;

    try {
      await playUriOnDevice(deviceId, track.spotifyUri);
    } catch (e) {
      // Device recém-criado às vezes ainda não é reconhecido: transfere e tenta de novo
      if (e instanceof SpotifyApiError && (e.status === 404 || e.status === 502)) {
        await transferPlayback(deviceId, false);
        await sleep(600);
        await playUriOnDevice(deviceId, track.spotifyUri);
      } else {
        throw e;
      }
    }
  }

  async play() {
    await this.player?.resume();
  }

  async pause() {
    await this.player?.pause();
  }

  async seek(ms: number) {
    await this.player?.seek(Math.round(ms));
  }

  setVolume(volume: number) {
    this.volume = volume;
    // O SDK rejeita 0 em alguns navegadores; usa um valor ínfimo
    void this.player?.setVolume(Math.max(volume, 0.0001));
  }

  async getPosition() {
    const fresh = await this.player?.getCurrentState();
    if (fresh) {
      this.lastState = fresh;
      this.lastStateAt = performance.now();
      return fresh.position;
    }
    const s = this.lastState;
    if (!s) return 0;
    return s.paused ? s.position : Math.min(s.duration, s.position + (performance.now() - this.lastStateAt));
  }

  getDuration() {
    return this.lastState?.duration ?? 0;
  }

  stop() {
    this.currentUri = null;
    if (this.lastState && !this.lastState.paused) void this.player?.pause();
  }

  destroy() {
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.ready = null;
    this.currentUri = null;
    this.lastState = null;
    this.hooks.onReadyChange(false);
  }

  get isReady() {
    return Boolean(this.deviceId);
  }
}
