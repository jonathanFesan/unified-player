/**
 * Motor YouTube — IFrame Player API.
 * Docs: https://developers.google.com/youtube/iframe_api_reference
 *
 * O <iframe> é criado dentro do container `#yt-host` renderizado pelo
 * componente <YouTubeHost/> (mini-player flutuante que pode ser minimizado).
 */
import { loadScript } from "@/lib/utils";
import type { EngineEvents, PlaybackEngine } from "@/lib/player/types";
import type { Track } from "@/types";

export const YT_HOST_ID = "yt-host";

// Códigos de estado do IFrame API (evita depender do enum global em runtime)
const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

const ERRORS: Record<number, string> = {
  2: "ID de vídeo inválido.",
  5: "Erro no player HTML5 do YouTube.",
  100: "Vídeo removido ou privado.",
  101: "O dono deste vídeo não permite reprodução incorporada.",
  150: "O dono deste vídeo não permite reprodução incorporada.",
};

export class YouTubeEngine implements PlaybackEngine {
  readonly kind = "youtube" as const;
  private player: YT.Player | null = null;
  private ready: Promise<YT.Player> | null = null;
  private volume = 0.8;

  constructor(private events: EngineEvents) {}

  private ensurePlayer(): Promise<YT.Player> {
    if (this.ready) return this.ready;

    this.ready = new Promise<YT.Player>((resolve, reject) => {
      const create = () => {
        const host = document.getElementById(YT_HOST_ID);
        if (!host) return reject(new Error("Container do player do YouTube não encontrado."));
        // Elemento filho imperativo: o IFrame API substitui o nó, então o React não pode gerenciá-lo.
        const mount = document.createElement("div");
        host.appendChild(mount);

        const player: YT.Player = new YT.Player(mount, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              player.setVolume(Math.round(this.volume * 100));
              this.player = player;
              resolve(player);
            },
            onStateChange: (e) => this.handleState(e.data),
            onError: (e) => this.events.onError(ERRORS[e.data] ?? `Erro ${e.data} no YouTube.`, { skip: true }),
          },
        });
      };

      if (window.YT?.Player) {
        create();
      } else {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          previous?.();
          create();
        };
        loadScript("https://www.youtube.com/iframe_api").catch(reject);
      }
    });

    this.ready.catch(() => {
      this.ready = null;
    });
    return this.ready;
  }

  private handleState(state: number) {
    switch (state) {
      case S.PLAYING:
        this.events.onBuffering(false);
        this.events.onPlayState(true);
        this.events.onDuration(this.getDuration());
        break;
      case S.PAUSED:
      case S.CUED:
        this.events.onBuffering(false);
        this.events.onPlayState(false);
        break;
      case S.BUFFERING:
        this.events.onBuffering(true);
        break;
      case S.ENDED:
        this.events.onPlayState(false);
        this.events.onEnded();
        break;
    }
  }

  async load(track: Track) {
    if (!track.videoId) throw new Error("Faixa do YouTube sem videoId.");
    const p = await this.ensurePlayer();
    p.loadVideoById(track.videoId);
  }

  async play() {
    this.player?.playVideo();
  }

  async pause() {
    this.player?.pauseVideo();
  }

  async seek(ms: number) {
    this.player?.seekTo(ms / 1000, true);
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.player?.setVolume(Math.round(volume * 100));
    if (this.player && volume > 0 && this.player.isMuted()) this.player.unMute();
  }

  async getPosition() {
    return (this.player?.getCurrentTime() ?? 0) * 1000;
  }

  getDuration() {
    return (this.player?.getDuration() ?? 0) * 1000;
  }

  stop() {
    this.player?.stopVideo();
  }
}
