"use client";

import { AlertCircle, ArrowLeft, ExternalLink, Heart, ListEnd, ListMusic, Loader2, Play, RefreshCw, Shuffle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Artwork, TrackRow } from "@/components/TrackRow";
import { getMyPlaylists, getPlaylistTracks, getSavedTracks, SpotifyApiError, type SpotifyPlaylistSummary } from "@/lib/spotify/api";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePlayerStore } from "@/lib/store/player-store";
import type { Track } from "@/types";

const LIKED_ID = "__liked__";

interface Selected {
  id: string;
  name: string;
  subtitle: string;
  image?: string;
  externalUrl?: string;
}

interface TracksState {
  status: "loading" | "success" | "error";
  tracks: Track[];
  total: number;
  error?: string;
}

// Cache da sessão: voltar para uma playlist já aberta não refaz as chamadas.
const tracksCache = new Map<string, TracksState>();
let playlistsCache: SpotifyPlaylistSummary[] | null = null;

function errorMessage(e: unknown): string {
  if (e instanceof SpotifyApiError) {
    if (e.message === "SCOPE") return "SCOPE";
    if (e.status === 404 || e.status === 403) {
      return "O Spotify não libera o conteúdo desta playlist para apps de terceiros (acontece com playlists criadas pelo próprio Spotify, como Daily Mix e Descobertas da Semana).";
    }
  }
  return e instanceof Error ? e.message : String(e);
}

function ScopeNotice() {
  const login = useAuthStore((s) => s.login);
  return (
    <div className="glass flex flex-col items-start gap-3 rounded-2xl p-5 text-sm sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0 text-amber-400" />
      <p className="flex-1 text-zinc-300">
        Para ler sua biblioteca, o app precisa de uma permissão nova. Reconecte o Spotify e aceite o acesso às playlists e
        músicas curtidas.
      </p>
      <button
        type="button"
        onClick={() => void login()}
        className="flex items-center gap-2 rounded-full bg-spotify px-4 py-2 font-semibold text-black transition hover:bg-spotify/90"
      >
        <RefreshCw className="size-4" /> Reconectar
      </button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (message === "SCOPE") return <ScopeNotice />;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-4 text-sm text-zinc-400">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
      <p>{message}</p>
    </div>
  );
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function TrackList({ selected, onBack }: { selected: Selected; onBack: () => void }) {
  const playAll = usePlayerStore((s) => s.playAll);
  const enqueueAll = usePlayerStore((s) => s.enqueueAll);
  const setNotice = usePlayerStore((s) => s.setNotice);
  const [state, setState] = useState<TracksState>(
    () => tracksCache.get(selected.id) ?? { status: "loading", tracks: [], total: 0 },
  );

  useEffect(() => {
    const cached = tracksCache.get(selected.id);
    if (cached?.status === "success") return;
    const ctrl = new AbortController();
    const onPage = (tracks: Track[], total: number) => {
      if (!ctrl.signal.aborted) setState({ status: "loading", tracks, total });
    };
    const load =
      selected.id === LIKED_ID
        ? getSavedTracks(onPage, ctrl.signal)
        : getPlaylistTracks(selected.id, onPage, ctrl.signal);
    load
      .then((tracks) => {
        const done: TracksState = { status: "success", tracks, total: tracks.length };
        tracksCache.set(selected.id, done);
        if (!ctrl.signal.aborted) setState(done);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, status: "error", error: errorMessage(e) }));
      });
    return () => ctrl.abort();
  }, [selected.id]);

  const { tracks } = state;
  const ready = tracks.length > 0;

  return (
    <div className="animate-fade-in space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="size-4" /> Biblioteca
      </button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {selected.id === LIKED_ID ? (
          <div className="grid size-32 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-spotify">
            <Heart className="size-12 fill-white text-white" />
          </div>
        ) : (
          <Artwork src={selected.image} className="size-32 shrink-0 rounded-2xl" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Playlist</p>
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{selected.name}</h1>
          <p className="text-sm text-zinc-400">
            {selected.subtitle}
            {state.status === "loading" && state.total > 0 && ` · carregando ${tracks.length} de ${state.total}…`}
            {state.status === "success" && ` · ${tracks.length} músicas`}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              disabled={!ready}
              onClick={() => playAll(tracks)}
              className="flex items-center gap-2 rounded-full bg-spotify px-5 py-2 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-spotify/90 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Play className="size-4 fill-black" /> Tocar tudo
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => playAll(shuffled(tracks))}
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <Shuffle className="size-4" /> Aleatório
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => {
                enqueueAll(tracks);
                setNotice(`${tracks.length} músicas adicionadas à fila`);
              }}
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <ListEnd className="size-4" /> Adicionar à fila
            </button>
            {selected.externalUrl && (
              <a
                href={selected.externalUrl}
                target="_blank"
                rel="noreferrer"
                title="Abrir no Spotify"
                className="grid size-9 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </div>
      </header>

      {state.status === "error" && <ErrorBox message={state.error ?? "Erro ao carregar."} />}

      {state.status === "loading" && !ready && (
        <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Carregando músicas…
        </div>
      )}

      {state.status === "success" && !ready && (
        <p className="py-10 text-center text-sm text-zinc-500">Nenhuma música nesta playlist.</p>
      )}

      {ready && (
        <section className="glass rounded-2xl p-2 sm:p-3">
          <ul className="space-y-0.5">
            {tracks.map((t, i) => (
              <TrackRow
                key={`${t.id}-${i}`}
                track={t}
                index={Math.min(i, 15)}
                onPlay={() => playAll(tracks, i)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PlaylistCard({
  title,
  subtitle,
  image,
  liked,
  onClick,
}: {
  title: string;
  subtitle: string;
  image?: string;
  liked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl p-2 text-left transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white/50"
    >
      {liked ? (
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-spotify">
          <Heart className="size-1/3 fill-white text-white" />
        </div>
      ) : (
        <Artwork src={image} className="aspect-square w-full rounded-xl" />
      )}
      <p className="mt-2 truncate text-sm font-medium text-zinc-100">{title}</p>
      <p className="truncate text-xs text-zinc-500">{subtitle}</p>
    </button>
  );
}

/** Biblioteca do Spotify: Músicas Curtidas + playlists do usuário. */
export function Library() {
  const user = useAuthStore((s) => s.user);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[] | null>(playlistsCache);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(null);
    getMyPlaylists()
      .then((p) => {
        playlistsCache = p;
        setPlaylists(p);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!playlistsCache) load();
  }, [load]);

  const open = (s: Selected) => {
    setSelected(s);
    topRef.current?.scrollIntoView({ block: "start" });
  };

  if (selected) {
    return (
      <div ref={topRef}>
        <TrackList selected={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div ref={topRef} className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ListMusic className="size-5 text-spotify" /> Sua biblioteca
        </h1>
        <button
          type="button"
          onClick={() => {
            playlistsCache = null;
            tracksCache.clear();
            setPlaylists(null);
            load();
          }}
          title="Atualizar"
          aria-label="Atualizar biblioteca"
          className="grid size-8 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {!error && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          <PlaylistCard
            liked
            title="Músicas Curtidas"
            subtitle={user?.displayName ?? "Você"}
            onClick={() => open({ id: LIKED_ID, name: "Músicas Curtidas", subtitle: user?.displayName ?? "" })}
          />
          {playlists === null
            ? Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="p-2">
                  <div className="aspect-square w-full animate-pulse rounded-xl bg-white/[0.06]" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ))
            : playlists.map((p) => {
                const subtitle = `${p.owner}${p.total ? ` · ${p.total} músicas` : ""}`;
                return (
                  <PlaylistCard
                    key={p.id}
                    title={p.name}
                    subtitle={subtitle}
                    image={p.image}
                    onClick={() =>
                      open({ id: p.id, name: p.name, subtitle: p.owner, image: p.image, externalUrl: p.externalUrl })
                    }
                  />
                );
              })}
        </div>
      )}
    </div>
  );
}
