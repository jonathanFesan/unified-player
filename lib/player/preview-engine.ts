/**
 * Motor de preview (30s) do Spotify via <audio> HTML5 — fallback para contas Free.
 * Observação: o Spotify depreciou `preview_url` para apps criados após 27/11/2024,
 * então muitas faixas virão sem preview; nesse caso o controller usa o YouTube.
 */
import type { EngineEvents, PlaybackEngine } from "@/lib/player/types";
import type { Track } from "@/types";

export class PreviewEngine implements PlaybackEngine {
  readonly kind = "spotify-preview" as const;
  private audio: HTMLAudioElement | null = null;
  private volume = 0.8;

  constructor(private events: EngineEvents) {}

  private el(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = "auto";
    a.volume = this.volume;
    a.addEventListener("playing", () => {
      this.events.onBuffering(false);
      this.events.onPlayState(true);
    });
    a.addEventListener("pause", () => this.events.onPlayState(false));
    a.addEventListener("waiting", () => this.events.onBuffering(true));
    a.addEventListener("loadedmetadata", () => this.events.onDuration(this.getDuration()));
    a.addEventListener("ended", () => this.events.onEnded());
    a.addEventListener("error", () => {
      if (a.src) this.events.onError("Não foi possível carregar o preview.", { skip: true });
    });
    this.audio = a;
    return a;
  }

  async load(track: Track) {
    if (!track.previewUrl) throw new Error("Faixa sem preview disponível.");
    const a = this.el();
    a.src = track.previewUrl;
    await this.play();
  }

  async play() {
    try {
      await this.el().play();
    } catch (e) {
      // Autoplay bloqueado pelo navegador: o usuário precisa clicar em play
      this.events.onPlayState(false);
      if ((e as DOMException).name !== "AbortError") throw e;
    }
  }

  async pause() {
    this.audio?.pause();
  }

  async seek(ms: number) {
    if (this.audio) this.audio.currentTime = ms / 1000;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.audio) this.audio.volume = volume;
  }

  async getPosition() {
    return (this.audio?.currentTime ?? 0) * 1000;
  }

  getDuration() {
    const d = this.audio?.duration;
    return d && Number.isFinite(d) ? d * 1000 : 0;
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
