/**
 * Wrapper mínimo da Spotify Web API.
 * Docs: https://developer.spotify.com/documentation/web-api
 */
import { getSpotifyAccessToken } from "@/lib/spotify/auth";
import type { SpotifyUser, Track } from "@/types";

const API = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function spotifyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSpotifyAccessToken();
  if (!token) throw new SpotifyApiError(401, "Conecte sua conta do Spotify.");

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204 || res.status === 202) return undefined as T;
  if (!res.ok) {
    let message = `Erro ${res.status} na API do Spotify`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      /* corpo vazio */
    }
    if (res.status === 403 && /not registered|developer dashboard/i.test(message)) {
      message =
        "Sua conta não está liberada neste app (modo desenvolvimento). Adicione-a em Spotify Dashboard → User Management.";
    }
    throw new SpotifyApiError(res.status, message);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- tipos crus da API (apenas o que usamos) ----------
interface RawImage {
  url: string;
  width: number | null;
}
interface RawTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  preview_url?: string | null;
  external_urls: { spotify: string };
  artists: { name: string }[];
  album: { name: string; images: RawImage[] };
}

function pickImage(images: RawImage[]): string | undefined {
  if (!images?.length) return undefined;
  // menor imagem com >= 300px; senão a primeira
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= 300) ?? images[0]).url;
}

export function mapSpotifyTrack(t: RawTrack): Track {
  return {
    id: `spotify:${t.id}`,
    source: "spotify",
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album?.name,
    artwork: pickImage(t.album?.images ?? []),
    durationMs: t.duration_ms,
    spotifyUri: t.uri,
    previewUrl: t.preview_url ?? null,
    externalUrl: t.external_urls?.spotify,
  };
}

// ---------- endpoints ----------
export async function getCurrentUser(): Promise<SpotifyUser> {
  const me = await spotifyFetch<{
    id: string;
    display_name: string | null;
    product?: string;
    images?: RawImage[];
  }>("/me");
  return {
    id: me.id,
    displayName: me.display_name ?? me.id,
    avatar: me.images?.[0]?.url,
    product: me.product ?? "free",
  };
}

export async function searchSpotifyTracks(query: string, limit = 10, signal?: AbortSignal): Promise<Track[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit), market: "from_token" });
  const data = await spotifyFetch<{ tracks: { items: (RawTrack | null)[] } }>(`/search?${params}`, { signal });
  return data.tracks.items.filter((t): t is RawTrack => Boolean(t)).map(mapSpotifyTrack);
}

// ---------- biblioteca ----------
export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  owner: string;
  image?: string;
  total: number;
  externalUrl?: string;
}

interface RawPlaylist {
  id: string;
  name: string;
  images?: RawImage[] | null;
  owner?: { display_name?: string | null; id: string };
  // A API antiga usa `tracks`, a nova usa `items` (ambos com `total`)
  tracks?: { total: number } | null;
  items?: { total: number } | null;
  external_urls?: { spotify: string };
}

interface RawPlaylistItem {
  is_local?: boolean;
  // `track` na API antiga, `item` na nova
  track?: (RawTrack & { type?: string }) | null;
  item?: (RawTrack & { type?: string }) | null;
}

interface Paging<T> {
  items: T[];
  next: string | null;
  total: number;
}

/** Mensagem amigável quando o token foi emitido antes das permissões de biblioteca existirem. */
function libraryError(e: unknown): never {
  if (e instanceof SpotifyApiError && (e.status === 401 || e.status === 403) && /scope/i.test(e.message)) {
    throw new SpotifyApiError(e.status, "SCOPE");
  }
  throw e;
}

function itemsToTracks(items: RawPlaylistItem[]): Track[] {
  return items
    .map((i) => i.item ?? i.track)
    .filter((t): t is RawTrack & { type?: string } => Boolean(t?.id) && (t?.type ?? "track") === "track")
    .filter((t) => !t.uri?.startsWith("spotify:local:"))
    .map(mapSpotifyTrack);
}

/** Lista todas as playlists do usuário (criadas e seguidas). */
export async function getMyPlaylists(): Promise<SpotifyPlaylistSummary[]> {
  const out: SpotifyPlaylistSummary[] = [];
  let path: string | null = "/me/playlists?limit=50";
  try {
    while (path) {
      const page: Paging<RawPlaylist | null> = await spotifyFetch(path);
      for (const p of page.items) {
        if (!p) continue;
        out.push({
          id: p.id,
          name: p.name,
          owner: p.owner?.display_name ?? p.owner?.id ?? "",
          image: p.images?.[0]?.url,
          total: p.items?.total ?? p.tracks?.total ?? 0,
          externalUrl: p.external_urls?.spotify,
        });
      }
      path = page.next ? page.next.replace(API, "") : null;
    }
  } catch (e) {
    libraryError(e);
  }
  return out;
}

const MAX_LIBRARY_TRACKS = 2000;

/**
 * Busca as faixas página por página. `onPage` recebe a lista acumulada a cada página,
 * para a tela ir mostrando enquanto carrega.
 */
async function collectTracks(
  firstPath: string,
  onPage: (tracks: Track[], total: number) => void,
  signal?: AbortSignal,
): Promise<Track[]> {
  const out: Track[] = [];
  let path: string | null = firstPath;
  try {
    while (path && out.length < MAX_LIBRARY_TRACKS) {
      const page: Paging<RawPlaylistItem> = await spotifyFetch(path, { signal });
      out.push(...itemsToTracks(page.items));
      onPage([...out], page.total);
      path = page.next ? page.next.replace(API, "") : null;
    }
  } catch (e) {
    libraryError(e);
  }
  return out;
}

/** Músicas Curtidas. */
export function getSavedTracks(onPage: (tracks: Track[], total: number) => void, signal?: AbortSignal) {
  return collectTracks("/me/tracks?limit=50&market=from_token", onPage, signal);
}

/** Faixas de uma playlist. Usa `/items` (API atual) e cai para `/tracks` (API antiga) se preciso. */
export async function getPlaylistTracks(
  playlistId: string,
  onPage: (tracks: Track[], total: number) => void,
  signal?: AbortSignal,
) {
  const id = encodeURIComponent(playlistId);
  try {
    return await collectTracks(`/playlists/${id}/items?limit=50&market=from_token`, onPage, signal);
  } catch (e) {
    if (e instanceof SpotifyApiError && e.status === 404) {
      return collectTracks(`/playlists/${id}/tracks?limit=50&market=from_token`, onPage, signal);
    }
    throw e;
  }
}

/** Transfere a reprodução para o device do Web Playback SDK. */
export function transferPlayback(deviceId: string, play = false): Promise<void> {
  return spotifyFetch<void>("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

/** Toca uma URI específica num device. */
export function playUriOnDevice(deviceId: string, uri: string, positionMs = 0): Promise<void> {
  return spotifyFetch<void>(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
  });
}
