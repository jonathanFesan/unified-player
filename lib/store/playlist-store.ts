/**
 * Playlists locais do UPlayed: listas próprias que misturam faixas do Spotify e do YouTube.
 *
 * Ficam salvas no localStorage deste navegador (não dependem de login nem de permissões
 * nas plataformas). Para levar para outro navegador/computador, use exportar/importar.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { Track } from "@/types";

export interface PlaylistEntry extends Track {
  /** ID da entrada na playlist (a mesma faixa pode ser reordenada/removida sem ambiguidade). */
  entryId: string;
  addedAt: number;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  tracks: PlaylistEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface AddResult {
  added: number;
  skipped: number;
}

interface PlaylistState {
  playlists: LocalPlaylist[];

  // ---- UI (não persistido) ----
  /** Playlist aberta na tela principal. */
  openId: string | null;
  /** Faixas aguardando a escolha de uma playlist no seletor. */
  picker: { tracks: Track[]; suggestedName?: string } | null;

  create: (name: string, tracks?: Track[]) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /** Adiciona ao fim, ignorando faixas que já estão na playlist. */
  addTracks: (id: string, tracks: Track[]) => AddResult;
  removeEntry: (id: string, entryId: string) => void;
  moveEntry: (id: string, from: number, to: number) => void;
  /** Mescla playlists vindas de um arquivo exportado (sempre como novas). */
  importPlaylists: (data: unknown) => number;

  open: (id: string | null) => void;
  openPicker: (tracks: Track[], suggestedName?: string) => void;
  closePicker: () => void;
}

/** Remove campos que só fazem sentido na fila (queueId) ou na playlist (entryId). */
export function toTrack(t: Track & { queueId?: string; entryId?: string; addedAt?: number }): Track {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { queueId, entryId, addedAt, ...track } = t;
  return track;
}

const toEntry = (t: Track): PlaylistEntry => ({ ...toTrack(t), entryId: uid(), addedAt: Date.now() });

const cleanName = (name: string) => name.trim().slice(0, 100) || "Nova playlist";

function isTrack(v: unknown): v is Track {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    (t.source === "spotify" || t.source === "youtube") &&
    typeof t.title === "string" &&
    typeof t.artist === "string"
  );
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => {
      const update = (id: string, fn: (p: LocalPlaylist) => LocalPlaylist) =>
        set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)) }));

      return {
        playlists: [],
        openId: null,
        picker: null,

        create: (name, tracks = []) => {
          const id = uid();
          const now = Date.now();
          const seen = new Set<string>();
          const unique = tracks.filter((t) => !seen.has(t.id) && seen.add(t.id));
          set((s) => ({
            playlists: [
              { id, name: cleanName(name), tracks: unique.map(toEntry), createdAt: now, updatedAt: now },
              ...s.playlists,
            ],
          }));
          return id;
        },

        rename: (id, name) => update(id, (p) => ({ ...p, name: cleanName(name) })),

        remove: (id) =>
          set((s) => ({
            playlists: s.playlists.filter((p) => p.id !== id),
            openId: s.openId === id ? null : s.openId,
          })),

        addTracks: (id, tracks) => {
          const playlist = get().playlists.find((p) => p.id === id);
          if (!playlist) return { added: 0, skipped: tracks.length };
          const seen = new Set(playlist.tracks.map((t) => t.id));
          const fresh = tracks.filter((t) => !seen.has(t.id) && seen.add(t.id));
          if (fresh.length) update(id, (p) => ({ ...p, tracks: [...p.tracks, ...fresh.map(toEntry)] }));
          return { added: fresh.length, skipped: tracks.length - fresh.length };
        },

        removeEntry: (id, entryId) =>
          update(id, (p) => ({ ...p, tracks: p.tracks.filter((t) => t.entryId !== entryId) })),

        moveEntry: (id, from, to) =>
          update(id, (p) => {
            if (from === to || to < 0 || to >= p.tracks.length) return p;
            const tracks = [...p.tracks];
            const [item] = tracks.splice(from, 1);
            tracks.splice(to, 0, item);
            return { ...p, tracks };
          }),

        importPlaylists: (data) => {
          const list = (data as { playlists?: unknown })?.playlists;
          if (!Array.isArray(list)) throw new Error("Arquivo inválido: não contém playlists do UPlayed.");
          const now = Date.now();
          const imported: LocalPlaylist[] = list
            .filter((p): p is { name?: unknown; tracks?: unknown } => Boolean(p) && typeof p === "object")
            .map((p) => ({
              id: uid(),
              name: cleanName(typeof p.name === "string" ? p.name : ""),
              tracks: (Array.isArray(p.tracks) ? p.tracks : []).filter(isTrack).map(toEntry),
              createdAt: now,
              updatedAt: now,
            }));
          if (!imported.length) throw new Error("Nenhuma playlist encontrada no arquivo.");
          set((s) => ({ playlists: [...imported, ...s.playlists] }));
          return imported.length;
        },

        open: (openId) => set({ openId }),
        openPicker: (tracks, suggestedName) => {
          if (tracks.length) set({ picker: { tracks: tracks.map(toTrack), suggestedName } });
        },
        closePicker: () => set({ picker: null }),
      };
    },
    {
      name: "uplayed-playlists",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Reidratado no cliente (usePlayerBootstrap) para evitar mismatch de SSR
      skipHydration: true,
      partialize: (s) => ({ playlists: s.playlists }),
    },
  ),
);

/** Conteúdo do arquivo de exportação (sem IDs internos). */
export function exportPayload(playlists: LocalPlaylist[]) {
  return {
    app: "UPlayed",
    version: 1,
    exportedAt: new Date().toISOString(),
    playlists: playlists.map((p) => ({ name: p.name, tracks: p.tracks.map(toTrack) })),
  };
}
