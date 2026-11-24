"use client";

import { Minimize2 } from "lucide-react";
import { YouTubeIcon } from "@/components/icons";
import { YT_HOST_ID } from "@/lib/player/youtube-engine";
import { usePlayerStore } from "@/lib/store/player-store";
import { cn } from "@/lib/utils";

/**
 * Container do IFrame do YouTube — sempre montado, para que o player
 * sobreviva a trocas de faixa. Visível como mini-player flutuante quando
 * o motor ativo é o YouTube; "minimizado" o move para fora da tela (sem
 * `display:none`, que faria alguns navegadores pausarem o vídeo).
 */
export function YouTubeHost() {
  const engine = usePlayerStore((s) => s.engine);
  const visible = usePlayerStore((s) => s.videoVisible);
  const setVideoVisible = usePlayerStore((s) => s.setVideoVisible);
  const shown = engine === "youtube" && visible;

  return (
    <div
      aria-hidden={!shown}
      className={cn(
        "glass fixed z-40 w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-2xl shadow-black/60 transition-[opacity,transform] duration-300",
        "right-3 bottom-[84px] md:right-5 md:bottom-28",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none right-auto! -left-[200vw]! translate-y-4 opacity-0",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400">
        <YouTubeIcon className="size-3.5 text-youtube" />
        <span className="flex-1">Reproduzindo do YouTube</span>
        <button
          type="button"
          aria-label="Minimizar vídeo"
          onClick={() => setVideoVisible(false)}
          className="grid size-6 place-items-center rounded-full hover:bg-white/10 hover:text-white"
        >
          <Minimize2 className="size-3.5" />
        </button>
      </div>
      <div id={YT_HOST_ID} className="aspect-video w-full bg-black [&>iframe]:size-full" />
    </div>
  );
}
