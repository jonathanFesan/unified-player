"use client";

import { useCallback, useRef, useState } from "react";
import { isYouTubeConfigured } from "@/lib/env";
import { searchSpotifyTracks } from "@/lib/spotify/api";
import { useAuthStore } from "@/lib/store/auth-store";
import { searchYouTubeVideos } from "@/lib/youtube/api";
import type { SourceSearchState, Track, TrackSource } from "@/types";

const idle: SourceSearchState = { status: "idle", results: [] };

/** Cache em memória — evita gastar cota do YouTube repetindo a mesma busca. */
const cache = new Map<string, Track[]>();

/**
 * Busca em paralelo no Spotify e no YouTube. Cada fonte tem seu próprio
 * status/erro: se uma falhar, a outra continua exibindo resultados.
 */
export function useUnifiedSearch() {
  const [query, setQuery] = useState("");
  const [spotify, setSpotify] = useState<SourceSearchState>(idle);
  const [youtube, setYouTube] = useState<SourceSearchState>(idle);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (
      source: TrackSource,
      q: string,
      fn: (q: string, limit: number, signal: AbortSignal) => Promise<Track[]>,
      set: (s: SourceSearchState) => void,
      signal: AbortSignal,
    ) => {
      const key = `${source}:${q.toLowerCase()}`;
      const hit = cache.get(key);
      if (hit) return set({ status: "success", results: hit });
      set({ status: "loading", results: [] });
      try {
        const results = await fn(q, 10, signal);
        cache.set(key, results);
        if (!signal.aborted) set({ status: "success", results });
      } catch (e) {
        if (signal.aborted) return;
        set({ status: "error", results: [], error: e instanceof Error ? e.message : String(e) });
      }
    },
    [],
  );

  const search = useCallback(
    (raw: string) => {
      const q = raw.trim();
      setQuery(q);
      controllerRef.current?.abort();
      if (!q) {
        setSpotify(idle);
        setYouTube(idle);
        return;
      }
      const ctrl = new AbortController();
      controllerRef.current = ctrl;

      if (useAuthStore.getState().status === "authenticated") {
        void run("spotify", q, searchSpotifyTracks, setSpotify, ctrl.signal);
      } else {
        setSpotify({ status: "error", results: [], error: "Conecte sua conta do Spotify para buscar no catálogo." });
      }

      if (isYouTubeConfigured()) {
        void run("youtube", q, searchYouTubeVideos, setYouTube, ctrl.signal);
      } else {
        setYouTube({ status: "error", results: [], error: "Defina NEXT_PUBLIC_YOUTUBE_API_KEY no .env.local." });
      }
    },
    [run],
  );

  return { query, spotify, youtube, search };
}
