"use client";

import { ExternalLink, ListEnd, ListStart, Music, Play } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import { usePlayerStore } from "@/lib/store/player-store";
import { cn, formatTime } from "@/lib/utils";
import type { Track } from "@/types";

export function Artwork({ src, className, alt = "" }: { src?: string; className?: string; alt?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- imagens de CDNs externos (scdn/ytimg)
    <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />
  ) : (
    <div className={cn("grid place-items-center bg-white/5 text-zinc-500", className)}>
      <Music className="size-1/3" />
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/50"
    >
      {children}
    </button>
  );
}

export function TrackRow({ track, index, onPlay }: { track: Track; index: number; onPlay?: () => void }) {
  const playNow = usePlayerStore((s) => s.playNow);
  const play = onPlay ?? (() => playNow(track));
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const isCurrent = usePlayerStore((s) => s.queue[s.currentIndex]?.id === track.id);

  return (
    <li
      className="group flex animate-slide-up items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.06]"
      style={{ animationDelay: `${index * 25}ms`, animationFillMode: "backwards" }}
    >
      <button
        type="button"
        onClick={play}
        aria-label={`Tocar ${track.title}`}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg",
          track.source === "youtube" ? "aspect-video h-12" : "size-12",
        )}
      >
        <Artwork src={track.artwork} className="size-full" />
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
          <Play className="size-5 fill-white text-white" />
        </span>
      </button>

      <button type="button" onClick={play} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-sm font-medium", isCurrent ? "text-brand-300" : "text-zinc-100")}>
          {track.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
          <SourceBadge source={track.source} compact />
          <span className="truncate">
            {track.artist}
            {track.album ? ` · ${track.album}` : ""}
          </span>
        </p>
      </button>

      <span className="hidden w-12 text-right text-xs tabular-nums text-zinc-500 sm:block">
        {track.durationMs ? formatTime(track.durationMs) : "—"}
      </span>

      <div className="flex items-center opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton label="Tocar a seguir" onClick={() => playNext(track)}>
          <ListStart className="size-4" />
        </IconButton>
        <IconButton label="Adicionar ao fim da fila" onClick={() => addToQueue(track)}>
          <ListEnd className="size-4" />
        </IconButton>
        {track.externalUrl && (
          <a
            href={track.externalUrl}
            target="_blank"
            rel="noreferrer"
            title={`Abrir no ${track.source === "spotify" ? "Spotify" : "YouTube"}`}
            className="hidden size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white sm:grid"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </li>
  );
}
