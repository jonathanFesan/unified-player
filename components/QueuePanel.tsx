"use client";

import { ChevronDown, ChevronUp, ListMusic, ListPlus, Trash2, X } from "lucide-react";
import { SourceBadge } from "@/components/SourceBadge";
import { Artwork } from "@/components/TrackRow";
import { usePlayerStore } from "@/lib/store/player-store";
import { usePlaylistStore } from "@/lib/store/playlist-store";
import { cn, formatTime } from "@/lib/utils";

function Equalizer({ paused }: { paused: boolean }) {
  return (
    <span className={cn("eq flex h-4 items-end text-brand-300", paused && "paused")} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * Fila híbrida (Spotify + YouTube). Em telas xl fica fixa à direita;
 * abaixo disso vira um drawer aberto pelo botão da barra do player.
 */
export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const open = usePlayerStore((s) => s.queueOpen);
  const { playAt, removeAt, move, clearQueue, setQueueOpen } = usePlayerStore.getState();

  const counts = queue.reduce(
    (acc, t) => ((acc[t.source] += 1), acc),
    { spotify: 0, youtube: 0 } as Record<"spotify" | "youtube", number>,
  );
  const remainingMs = queue.slice(currentIndex + 1).reduce((a, t) => a + t.durationMs, 0);

  return (
    <>
      {/* Overlay (mobile/tablet) */}
      <div
        onClick={() => setQueueOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition xl:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label="Fila de reprodução"
        className={cn(
          "glass fixed top-0 right-0 bottom-[72px] z-30 flex w-full max-w-sm flex-col transition-transform duration-300 md:bottom-26 md:rounded-l-2xl",
          "xl:sticky xl:top-20 xl:z-0 xl:h-[calc(100dvh-11rem)] xl:w-80 xl:max-w-none xl:translate-x-0 xl:rounded-2xl",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <ListMusic className="size-4 text-zinc-400" />
          <h2 className="text-sm font-semibold">Fila</h2>
          <span className="text-xs text-zinc-500">
            {queue.length} {queue.length === 1 ? "faixa" : "faixas"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {queue.length > 0 && (
              <button
                type="button"
                title="Salvar a fila como playlist"
                onClick={() =>
                  usePlaylistStore
                    .getState()
                    .openPicker(queue, `Fila de ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`)
                }
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <ListPlus className="size-3.5" /> Salvar
              </button>
            )}
            {queue.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="size-3.5" /> Limpar
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar fila"
              onClick={() => setQueueOpen(false)}
              className="grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white xl:hidden"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {queue.length > 0 && (
          <div className="flex items-center gap-3 px-4 pt-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-spotify" /> {counts.spotify} Spotify
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-youtube" /> {counts.youtube} YouTube
            </span>
            {remainingMs > 0 && <span className="ml-auto">{formatTime(remainingMs)} restantes</span>}
          </div>
        )}

        {queue.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-zinc-500">
            <ListMusic className="size-8 opacity-40" />
            <p>Sua fila está vazia.</p>
            <p className="text-xs">Misture faixas do Spotify e do YouTube — elas tocam em sequência.</p>
          </div>
        ) : (
          <ol className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2">
            {queue.map((t, i) => {
              const isCurrent = i === currentIndex;
              const isPast = i < currentIndex;
              return (
                <li
                  key={t.queueId}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl p-1.5 pr-1 transition",
                    isCurrent ? "bg-brand-300/[0.09] ring-1 ring-brand-300/15" : "hover:bg-white/[0.05]",
                    isPast && "opacity-50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => playAt(i)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    aria-current={isCurrent}
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
                      <Artwork src={t.artwork} className="size-full" />
                      {isCurrent && (
                        <span className="absolute inset-0 grid place-items-center bg-black/60">
                          <Equalizer paused={!isPlaying} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-[13px] font-medium", isCurrent && "text-brand-300")}>{t.title}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-zinc-400">
                        <SourceBadge source={t.source} compact />
                        <span className="truncate">{t.artist}</span>
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Mover para cima"
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                        className="grid h-4 w-6 place-items-center text-zinc-500 hover:text-white disabled:opacity-20"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Mover para baixo"
                        disabled={i === queue.length - 1}
                        onClick={() => move(i, i + 1)}
                        className="grid h-4 w-6 place-items-center text-zinc-500 hover:text-white disabled:opacity-20"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label="Remover da fila"
                      onClick={() => removeAt(i)}
                      className="grid size-7 place-items-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </>
  );
}
