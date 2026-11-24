"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  ListEnd,
  ListMusic,
  Pencil,
  Play,
  Plus,
  Shuffle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Artwork, TrackRow } from "@/components/TrackRow";
import { usePlayerStore } from "@/lib/store/player-store";
import { exportPayload, type LocalPlaylist, usePlaylistStore } from "@/lib/store/playlist-store";
import { cn, formatTime, shuffled } from "@/lib/utils";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Capa da playlist: mosaico com as 4 primeiras capas, ou o gradiente da marca. */
export function PlaylistCover({ playlist, className }: { playlist: LocalPlaylist; className?: string }) {
  const arts = playlist.tracks.map((t) => t.artwork).filter((a): a is string => Boolean(a));
  if (arts.length >= 4) {
    return (
      <div className={cn("grid shrink-0 grid-cols-2 overflow-hidden", className)}>
        {arts.slice(0, 4).map((src, i) => (
          <Artwork key={i} src={src} className="size-full" />
        ))}
      </div>
    );
  }
  if (arts.length) return <Artwork src={arts[0]} className={cn("shrink-0 overflow-hidden", className)} />;
  return (
    <div className={cn("grid shrink-0 place-items-center bg-brand-gradient text-surface", className)}>
      <ListMusic className="size-2/5" />
    </div>
  );
}

function sourceCounts(p: LocalPlaylist) {
  const spotify = p.tracks.filter((t) => t.source === "spotify").length;
  return { spotify, youtube: p.tracks.length - spotify };
}

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Seção "Suas playlists" da tela inicial. */
export function LocalPlaylistsSection() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const { create, open, importPlaylists } = usePlaylistStore.getState();
  const { setNotice, setError } = usePlayerStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  const newPlaylist = () => open(create(`Minha playlist nº ${playlists.length + 1}`));

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const n = importPlaylists(JSON.parse(await file.text()));
      setNotice(`${plural(n, "playlist importada", "playlists importadas")}`);
    } catch (e) {
      setError(e instanceof SyntaxError ? "Esse arquivo não é um JSON válido." : (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const smallBtn =
    "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white";

  return (
    <section className="animate-fade-in space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <ListMusic className="size-5 text-brand-300" /> Suas playlists
        </h2>
        <span className="text-xs text-zinc-500">Spotify e YouTube juntos · salvas neste navegador</span>
        <div className="ml-auto flex items-center">
          <button type="button" className={smallBtn} onClick={() => fileRef.current?.click()} title="Importar de um arquivo .json">
            <Upload className="size-3.5" /> Importar
          </button>
          {playlists.length > 0 && (
            <button
              type="button"
              className={smallBtn}
              title="Baixar todas as playlists em um arquivo .json"
              onClick={() => download("uplayed-playlists.json", exportPayload(playlists))}
            >
              <Download className="size-3.5" /> Exportar
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
        <button
          type="button"
          onClick={newPlaylist}
          className="group min-w-0 rounded-2xl p-2 text-left transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white/50"
        >
          <div className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-brand-300/30 text-brand-300 transition group-hover:border-brand-300/60 group-hover:bg-brand-300/5">
            <Plus className="size-1/4" />
          </div>
          <p className="mt-2 truncate text-sm font-medium text-zinc-100">Nova playlist</p>
          <p className="truncate text-xs text-zinc-500">Misture as duas fontes</p>
        </button>

        {playlists.map((p) => {
          const c = sourceCounts(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => open(p.id)}
              className="group min-w-0 rounded-2xl p-2 text-left transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white/50"
            >
              <PlaylistCover playlist={p} className="aspect-square w-full rounded-xl" />
              <p className="mt-2 truncate text-sm font-medium text-zinc-100">{p.name}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                {p.tracks.length === 0 ? (
                  "Vazia"
                ) : (
                  <>
                    {c.spotify > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-spotify" /> {c.spotify}
                      </span>
                    )}
                    {c.youtube > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-youtube" /> {c.youtube}
                      </span>
                    )}
                    <span>· {plural(p.tracks.length, "faixa", "faixas")}</span>
                  </>
                )}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Tela de uma playlist local. */
export function LocalPlaylistView({ id }: { id: string }) {
  const playlist = usePlaylistStore((s) => s.playlists.find((p) => p.id === id));
  const { open, rename, remove, removeEntry, moveEntry } = usePlaylistStore.getState();
  const { playAll, enqueueAll, setNotice } = usePlayerStore.getState();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) nameRef.current?.select();
  }, [editing]);

  // Playlist apagada (ou de outro navegador): volta para a tela inicial.
  useEffect(() => {
    if (!playlist) open(null);
  }, [playlist, open]);
  if (!playlist) return null;

  const tracks = playlist.tracks;
  const ready = tracks.length > 0;
  const c = sourceCounts(playlist);
  const totalMs = tracks.reduce((a, t) => a + t.durationMs, 0);

  const saveName = (e?: React.FormEvent) => {
    e?.preventDefault();
    rename(id, name);
    setEditing(false);
  };

  const outlineBtn =
    "flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-40";

  return (
    <div className="animate-fade-in space-y-4">
      <button
        type="button"
        onClick={() => open(null)}
        className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="size-4" /> Início
      </button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <PlaylistCover playlist={playlist} className="size-32 rounded-2xl shadow-xl shadow-black/40" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Playlist UPlayed</p>
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-2">
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => saveName()}
                onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
                maxLength={100}
                aria-label="Nome da playlist"
                className="font-display h-11 w-full min-w-0 rounded-xl border border-brand-300/40 bg-white/[0.06] px-3 text-2xl font-bold outline-none focus:ring-4 focus:ring-brand-300/10"
              />
            </form>
          ) : (
            <h1 className="font-display flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="truncate">{playlist.name}</span>
              <button
                type="button"
                title="Renomear"
                aria-label="Renomear playlist"
                onClick={() => {
                  setName(playlist.name);
                  setEditing(true);
                }}
                className="grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-white"
              >
                <Pencil className="size-4" />
              </button>
            </h1>
          )}
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-400">
            <span>{plural(tracks.length, "faixa", "faixas")}</span>
            {c.spotify > 0 && (
              <span className="flex items-center gap-1">
                · <span className="size-1.5 rounded-full bg-spotify" /> {c.spotify} Spotify
              </span>
            )}
            {c.youtube > 0 && (
              <span className="flex items-center gap-1">
                · <span className="size-1.5 rounded-full bg-youtube" /> {c.youtube} YouTube
              </span>
            )}
            {totalMs > 0 && <span>· {formatTime(totalMs)}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              disabled={!ready}
              onClick={() => playAll(tracks)}
              className="flex items-center gap-2 rounded-full btn-brand px-5 py-2 text-sm font-bold transition hover:scale-[1.03] hover:brightness-110 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Play className="size-4 fill-current" /> Tocar tudo
            </button>
            <button type="button" disabled={!ready} onClick={() => playAll(shuffled(tracks))} className={outlineBtn}>
              <Shuffle className="size-4" /> Aleatório
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => {
                enqueueAll(tracks);
                setNotice(`${plural(tracks.length, "faixa adicionada", "faixas adicionadas")} à fila`);
              }}
              className={outlineBtn}
            >
              <ListEnd className="size-4" /> Adicionar à fila
            </button>
            <button
              type="button"
              title="Excluir playlist"
              aria-label="Excluir playlist"
              onClick={() => {
                if (window.confirm(`Excluir a playlist “${playlist.name}”? Isso não pode ser desfeito.`)) {
                  remove(id);
                  setNotice(`Playlist “${playlist.name}” excluída`);
                }
              }}
              className="grid size-9 place-items-center rounded-full text-zinc-400 transition hover:bg-red-500/15 hover:text-red-300"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {ready ? (
        <section className="glass rounded-2xl p-2 sm:p-3">
          <ul className="space-y-0.5">
            {tracks.map((t, i) => (
              <TrackRow
                key={t.entryId}
                track={t}
                index={Math.min(i, 15)}
                onPlay={() => playAll(tracks, i)}
                actions={
                  <>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Mover para cima"
                        disabled={i === 0}
                        onClick={() => moveEntry(id, i, i - 1)}
                        className="grid h-4 w-6 place-items-center text-zinc-500 hover:text-white disabled:opacity-20"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Mover para baixo"
                        disabled={i === tracks.length - 1}
                        onClick={() => moveEntry(id, i, i + 1)}
                        className="grid h-4 w-6 place-items-center text-zinc-500 hover:text-white disabled:opacity-20"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      title="Remover da playlist"
                      aria-label="Remover da playlist"
                      onClick={() => removeEntry(id, t.entryId)}
                      className="grid size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        </section>
      ) : (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center text-sm text-zinc-400">
          <ListMusic className="size-8 text-brand-300/60" />
          <p className="text-zinc-200">Playlist vazia</p>
          <p className="max-w-sm text-xs">
            Busque uma música no Spotify ou no YouTube e use o botão <strong className="text-zinc-200">Adicionar à playlist</strong>{" "}
            em qualquer faixa. Você também pode salvar a fila inteira pelo painel da fila.
          </p>
        </div>
      )}
    </div>
  );
}
