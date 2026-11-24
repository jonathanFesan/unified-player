"use client";

import { ListPlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PlaylistCover } from "@/components/LocalPlaylists";
import { usePlayerStore } from "@/lib/store/player-store";
import { usePlaylistStore } from "@/lib/store/playlist-store";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Janela "Adicionar à playlist": escolhe uma playlist local existente ou cria uma nova. */
export function PlaylistPicker() {
  const picker = usePlaylistStore((s) => s.picker);
  const playlists = usePlaylistStore((s) => s.playlists);
  const { addTracks, create, closePicker } = usePlaylistStore.getState();
  const setNotice = usePlayerStore((s) => s.setNotice);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!picker) return;
    setName(picker.suggestedName ?? "");
    // Sem playlists, o único caminho é criar uma: foca o nome direto.
    if (!usePlaylistStore.getState().playlists.length || picker.suggestedName) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePicker();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picker, closePicker]);

  if (!picker) return null;
  const { tracks } = picker;
  const what = tracks.length === 1 ? `“${tracks[0].title}”` : plural(tracks.length, "faixa", "faixas");

  const addTo = (id: string, playlistName: string) => {
    const { added, skipped } = addTracks(id, tracks);
    if (!added) setNotice(tracks.length === 1 ? `Essa faixa já está em “${playlistName}”` : `Todas já estavam em “${playlistName}”`);
    else
      setNotice(
        `${plural(added, "faixa adicionada", "faixas adicionadas")} a “${playlistName}”` +
          (skipped ? ` (${skipped} já ${skipped === 1 ? "estava" : "estavam"} lá)` : ""),
      );
    closePicker();
  };

  const createNew = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || "Nova playlist";
    create(finalName, tracks);
    setNotice(`Playlist “${finalName}” criada com ${plural(tracks.length, "faixa", "faixas")}`);
    closePicker();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal aria-labelledby="picker-title">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={closePicker} />
      <div className="glass relative flex max-h-[min(36rem,85dvh)] w-full max-w-md animate-slide-up flex-col rounded-2xl bg-elevated/90 shadow-2xl shadow-black/50">
        <header className="flex items-start gap-3 border-b border-white/5 p-4">
          <ListPlus className="mt-0.5 size-5 shrink-0 text-brand-300" />
          <div className="min-w-0 flex-1">
            <h2 id="picker-title" className="font-display font-semibold">
              Adicionar à playlist
            </h2>
            <p className="truncate text-xs text-zinc-400">{what}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={closePicker}
            className="grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={createNew} className="flex gap-2 p-4 pb-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Nome da nova playlist"
            aria-label="Nome da nova playlist"
            className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-300/50 focus:ring-4 focus:ring-brand-300/10"
          />
          <button type="submit" className="flex h-10 shrink-0 items-center gap-1.5 rounded-full btn-brand px-4 text-sm font-bold hover:brightness-110">
            <Plus className="size-4" /> Criar
          </button>
        </form>

        {playlists.length > 0 ? (
          <ul className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2 pt-0">
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => addTo(p.id, p.name)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
                >
                  <PlaylistCover playlist={p} className="size-11 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-zinc-500">{plural(p.tracks.length, "faixa", "faixas")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-5 text-xs text-zinc-500">
            Você ainda não tem playlists. Dê um nome e crie a primeira — ela pode misturar Spotify e YouTube.
          </p>
        )}
      </div>
    </div>
  );
}
