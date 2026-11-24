"use client";

import {
  ListMusic,
  Loader2,
  MonitorPlay,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Slider } from "@/components/Slider";
import { SourceBadge } from "@/components/SourceBadge";
import { Artwork } from "@/components/TrackRow";
import { playerActions } from "@/hooks/usePlayer";
import { selectCurrentTrack, usePlayerStore } from "@/lib/store/player-store";
import { cn, formatTime } from "@/lib/utils";
import type { EngineKind } from "@/types";

const ENGINE_LABEL: Record<EngineKind, string> = {
  "spotify-sdk": "Spotify Web Playback",
  "spotify-preview": "Prévia de 30s",
  youtube: "YouTube IFrame",
};

function CtrlButton({
  label,
  onClick,
  active,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative grid size-9 place-items-center rounded-full transition hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400",
        active ? "text-spotify" : "text-zinc-400",
        className,
      )}
    >
      {children}
      {active && <span className="absolute bottom-0.5 size-1 rounded-full bg-current" />}
    </button>
  );
}

function Progress({ compact }: { compact?: boolean }) {
  const positionMs = usePlayerStore((s) => s.positionMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const hasTrack = usePlayerStore((s) => s.currentIndex >= 0);
  const source = usePlayerStore((s) => selectCurrentTrack(s)?.source);
  const fill = source === "youtube" ? "var(--color-youtube)" : source === "spotify" ? "var(--color-spotify)" : "#fff";

  if (compact) {
    const pct = durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0;
    return (
      <div className="absolute inset-x-3 top-0 h-0.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full transition-[width] duration-500 ease-linear" style={{ width: `${pct}%`, background: fill }} />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2 text-[11px] tabular-nums text-zinc-400">
      <span className="w-10 text-right">{formatTime(positionMs)}</span>
      <Slider
        label="Posição da faixa"
        value={positionMs}
        max={durationMs}
        step={1000}
        disabled={!hasTrack || !durationMs}
        onCommit={(v) => playerActions.seek(v)}
        valueText={(v) => `${formatTime(v)} de ${formatTime(durationMs)}`}
        fill={fill}
      />
      <span className="w-10">{formatTime(durationMs)}</span>
    </div>
  );
}

function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex w-36 items-center gap-1">
      <CtrlButton label={muted ? "Ativar som" : "Silenciar"} onClick={toggleMute}>
        <Icon className="size-4" />
      </CtrlButton>
      <Slider
        label="Volume"
        value={effective * 100}
        max={100}
        onInput={(v) => setVolume(v / 100)}
        onCommit={(v) => setVolume(v / 100)}
        valueText={(v) => `${Math.round(v)}%`}
      />
    </div>
  );
}

export function PlayerBar() {
  const track = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const repeat = usePlayerStore((s) => s.repeat);
  const engine = usePlayerStore((s) => s.engine);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const videoVisible = usePlayerStore((s) => s.videoVisible);
  const { cycleRepeat, setQueueOpen, setVideoVisible } = usePlayerStore.getState();

  const PlayIcon = isBuffering && isPlaying ? Loader2 : isPlaying ? Pause : Play;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <footer className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:inset-x-3 md:bottom-3 md:rounded-2xl md:border-x md:border-b">
      <div className="relative mx-auto flex h-[72px] items-center gap-3 px-3 md:grid md:h-20 md:grid-cols-[1fr_minmax(0,1.6fr)_1fr] md:px-4">
        {/* Progresso compacto no mobile */}
        <div className="md:hidden">
          <Progress compact />
        </div>

        {/* Faixa atual */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-lg bg-white/5 shadow-lg shadow-black/40",
              track?.source === "youtube" ? "aspect-video h-12 md:h-14" : "size-12 md:size-14",
            )}
          >
            {track && <Artwork src={track.artwork} className="size-full" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{track?.title ?? "Nada tocando"}</p>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
              {track && <SourceBadge source={track.source} compact />}
              <span className="truncate">{track?.artist ?? "Busque uma música para começar"}</span>
            </div>
            {engine && (
              <p className="hidden truncate text-[10px] text-zinc-500 md:block">via {ENGINE_LABEL[engine]}</p>
            )}
          </div>
        </div>

        {/* Controles */}
        <div className="flex shrink-0 flex-col items-center gap-0.5 md:min-w-0">
          <div className="flex items-center gap-1 md:gap-2">
            <CtrlButton
              label={`Repetir: ${repeat === "off" ? "desligado" : repeat === "all" ? "fila" : "faixa"}`}
              onClick={cycleRepeat}
              active={repeat !== "off"}
              className="hidden md:grid"
            >
              <RepeatIcon className="size-4" />
            </CtrlButton>
            <CtrlButton label="Anterior" onClick={playerActions.previous} disabled={!queueLength} className="hidden sm:grid">
              <SkipBack className="size-5 fill-current" />
            </CtrlButton>
            <button
              type="button"
              aria-label={isPlaying ? "Pausar" : "Tocar"}
              onClick={playerActions.togglePlay}
              disabled={!queueLength}
              className="grid size-11 place-items-center rounded-full bg-white text-black shadow-lg shadow-black/30 transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 md:size-10"
            >
              <PlayIcon
                className={cn("size-5", PlayIcon === Loader2 ? "animate-spin" : "fill-current", PlayIcon === Play && "ml-0.5")}
              />
            </button>
            <CtrlButton label="Próxima" onClick={playerActions.next} disabled={!queueLength}>
              <SkipForward className="size-5 fill-current" />
            </CtrlButton>
            {engine === "youtube" && !videoVisible && (
              <CtrlButton label="Mostrar vídeo" onClick={() => setVideoVisible(true)} className="md:hidden">
                <MonitorPlay className="size-5" />
              </CtrlButton>
            )}
            <CtrlButton
              label="Fila de reprodução"
              onClick={() => setQueueOpen(!queueOpen)}
              active={queueOpen}
              className="md:hidden"
            >
              <ListMusic className="size-5" />
            </CtrlButton>
          </div>
          <div className="hidden w-full max-w-xl md:block">
            <Progress />
          </div>
        </div>

        {/* Extras */}
        <div className="hidden items-center justify-end gap-1 md:flex">
          {engine === "youtube" && (
            <CtrlButton
              label={videoVisible ? "Ocultar vídeo" : "Mostrar vídeo"}
              onClick={() => setVideoVisible(!videoVisible)}
              active={videoVisible}
            >
              <MonitorPlay className="size-4" />
            </CtrlButton>
          )}
          <CtrlButton label="Fila de reprodução" onClick={() => setQueueOpen(!queueOpen)} active={queueOpen} className="xl:hidden">
            <ListMusic className="size-4" />
          </CtrlButton>
          <VolumeControl />
        </div>
      </div>
    </footer>
  );
}
