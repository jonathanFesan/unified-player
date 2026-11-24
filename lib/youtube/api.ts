/**
 * YouTube Data API v3 — busca de vídeos.
 * Docs: https://developers.google.com/youtube/v3/docs/search/list
 *
 * Custo de cota: search.list = 100 unidades, videos.list = 1 unidade.
 * Cota padrão do projeto: 10.000 unidades/dia (~99 buscas).
 */
import { env } from "@/lib/env";
import { decodeHtml, parseIsoDuration } from "@/lib/utils";
import type { Track } from "@/types";

const API = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface SearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: Record<string, { url: string } | undefined>;
  };
}

async function ytFetch<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  if (!env.youtubeApiKey) throw new YouTubeApiError(0, "Configure NEXT_PUBLIC_YOUTUBE_API_KEY no .env.local.");
  const qs = new URLSearchParams({ ...params, key: env.youtubeApiKey });
  const res = await fetch(`${API}${path}?${qs}`, { signal });
  if (!res.ok) {
    let message = `Erro ${res.status} na YouTube Data API`;
    try {
      const body = await res.json();
      const reason: string | undefined = body?.error?.errors?.[0]?.reason;
      message = body?.error?.message ?? message;
      if (reason === "quotaExceeded") message = "Cota diária da YouTube Data API esgotada. Tente amanhã.";
    } catch {
      /* ignore */
    }
    throw new YouTubeApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

/** Limpa sufixos comuns de canais oficiais ("Artista - Topic", "ArtistaVEVO"). */
function cleanChannel(name: string): string {
  return name.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
}

export async function searchYouTubeVideos(query: string, limit = 10, signal?: AbortSignal): Promise<Track[]> {
  const search = await ytFetch<{ items: SearchItem[] }>(
    "/search",
    {
      part: "snippet",
      q: query,
      type: "video",
      videoCategoryId: "10", // Música
      videoEmbeddable: "true", // apenas vídeos que podem ser tocados no IFrame
      maxResults: String(limit),
      safeSearch: "none",
    },
    signal,
  );

  const items = search.items.filter((i) => i.id.videoId);
  if (!items.length) return [];

  // Busca durações (1 unidade de cota) — o search.list não retorna duração.
  const durations = new Map<string, number>();
  try {
    const details = await ytFetch<{ items: { id: string; contentDetails: { duration: string } }[] }>(
      "/videos",
      { part: "contentDetails", id: items.map((i) => i.id.videoId!).join(",") },
      signal,
    );
    for (const d of details.items) durations.set(d.id, parseIsoDuration(d.contentDetails.duration));
  } catch {
    /* duração é opcional — o IFrame informa ao carregar */
  }

  return items.map((i) => {
    const videoId = i.id.videoId!;
    const t = i.snippet.thumbnails;
    return {
      id: `youtube:${videoId}`,
      source: "youtube" as const,
      title: decodeHtml(i.snippet.title),
      artist: cleanChannel(decodeHtml(i.snippet.channelTitle)),
      artwork: (t.high ?? t.medium ?? t.default)?.url,
      durationMs: durations.get(videoId) ?? 0,
      videoId,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  });
}

/** Encontra o melhor vídeo equivalente a uma faixa (usado como fallback do Spotify Free). */
export async function findYouTubeEquivalent(track: Track): Promise<Track | null> {
  const results = await searchYouTubeVideos(`${track.artist} - ${track.title} audio`, 1);
  return results[0] ?? null;
}
