/**
 * Estado global do player + fila híbrida.
 *
 * O store contém apenas ESTADO e mutações puras da fila. Quem efetivamente
 * toca o áudio é o `PlayerController` (lib/player/controller.ts), que observa
 * `loadId` e carrega a faixa atual no motor correto (Spotify SDK, preview ou YouTube).
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { EngineKind, QueueItem, RepeatMode, Track } from "@/types";

export interface PlayerState {
  queue: QueueItem[];
  currentIndex: number; // -1 = nada selecionado
  /** Incrementado sempre que a faixa atual deve ser (re)carregada no motor. */
  loadId: number;
  /** Se o próximo carregamento deve começar tocando. */
  autoplay: boolean;

  isPlaying: boolean;
  isBuffering: boolean;
  positionMs: number;
  durationMs: number;
  volume: number; // 0..1
  muted: boolean;
  repeat: RepeatMode;

  engine: EngineKind | null;
  /** Mensagem informativa (ex.: "tocando via YouTube") */
  notice: string | null;
  error: string | null;

  queueOpen: boolean;
  videoVisible: boolean;

  // ---- ações de fila ----
  /** Toca imediatamente: insere após a faixa atual e pula para ela. */
  playNow: (track: Track) => void;
  /** Adiciona ao fim da fila (e toca se a fila estiver vazia). */
  addToQueue: (track: Track) => void;
  /** Insere logo após a faixa atual. */
  playNext: (track: Track) => void;
  /** Substitui a fila pela lista e começa a tocar em `start`. */
  playAll: (tracks: Track[], start?: number) => void;
  /** Adiciona várias faixas ao fim da fila. */
  enqueueAll: (tracks: Track[]) => void;
  playAt: (index: number) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  clearQueue: () => void;
  next: (opts?: { auto?: boolean }) => void;
  previous: () => void;

  // ---- ações de UI/estado ----
  setPlayback: (p: Partial<Pick<PlayerState, "isPlaying" | "isBuffering" | "positionMs" | "durationMs" | "engine">>) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  setNotice: (msg: string | null) => void;
  setError: (msg: string | null) => void;
  setQueueOpen: (open: boolean) => void;
  setVideoVisible: (v: boolean) => void;
}

const toItem = (t: Track): QueueItem => ({ ...t, queueId: uid() });

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      loadId: 0,
      autoplay: false,
      isPlaying: false,
      isBuffering: false,
      positionMs: 0,
      durationMs: 0,
      volume: 0.8,
      muted: false,
      repeat: "off",
      engine: null,
      notice: null,
      error: null,
      queueOpen: false,
      videoVisible: true,

      playNow: (track) =>
        set((s) => {
          const at = s.currentIndex + 1;
          const queue = [...s.queue];
          queue.splice(at, 0, toItem(track));
          return { queue, currentIndex: at, loadId: s.loadId + 1, autoplay: true, error: null };
        }),

      addToQueue: (track) =>
        set((s) => {
          const queue = [...s.queue, toItem(track)];
          if (s.currentIndex === -1) {
            return { queue, currentIndex: queue.length - 1, loadId: s.loadId + 1, autoplay: true };
          }
          return { queue };
        }),

      playNext: (track) => {
        const s = get();
        if (s.currentIndex === -1) return s.addToQueue(track);
        const queue = [...s.queue];
        queue.splice(s.currentIndex + 1, 0, toItem(track));
        set({ queue });
      },

      playAll: (tracks, start = 0) =>
        set((s) =>
          tracks.length
            ? {
                queue: tracks.map(toItem),
                currentIndex: Math.min(Math.max(start, 0), tracks.length - 1),
                loadId: s.loadId + 1,
                autoplay: true,
                error: null,
              }
            : {},
        ),

      enqueueAll: (tracks) =>
        set((s) => {
          if (!tracks.length) return {};
          const queue = [...s.queue, ...tracks.map(toItem)];
          if (s.currentIndex === -1) {
            return { queue, currentIndex: s.queue.length, loadId: s.loadId + 1, autoplay: true };
          }
          return { queue };
        }),

      playAt: (index) =>
        set((s) =>
          index >= 0 && index < s.queue.length
            ? { currentIndex: index, loadId: s.loadId + 1, autoplay: true, error: null }
            : {},
        ),

      removeAt: (index) =>
        set((s) => {
          const queue = s.queue.filter((_, i) => i !== index);
          if (index < s.currentIndex) return { queue, currentIndex: s.currentIndex - 1 };
          if (index > s.currentIndex) return { queue };
          // removendo a faixa atual: toca a que ocupar a posição (ou para)
          if (!queue.length) {
            return { queue, currentIndex: -1, loadId: s.loadId + 1, isPlaying: false, positionMs: 0, durationMs: 0 };
          }
          const nextIndex = Math.min(index, queue.length - 1);
          return { queue, currentIndex: nextIndex, loadId: s.loadId + 1, autoplay: s.isPlaying };
        }),

      move: (from, to) =>
        set((s) => {
          if (from === to || to < 0 || to >= s.queue.length) return {};
          const queue = [...s.queue];
          const [item] = queue.splice(from, 1);
          queue.splice(to, 0, item);
          const currentId = s.queue[s.currentIndex]?.queueId;
          return { queue, currentIndex: queue.findIndex((q) => q.queueId === currentId) };
        }),

      clearQueue: () =>
        set((s) => ({
          queue: [],
          currentIndex: -1,
          loadId: s.loadId + 1,
          isPlaying: false,
          positionMs: 0,
          durationMs: 0,
          engine: null,
          notice: null,
        })),

      next: (opts) =>
        set((s) => {
          if (!s.queue.length) return {};
          let nextIndex = s.currentIndex + 1;
          if (nextIndex >= s.queue.length) {
            if (s.repeat === "all") nextIndex = 0;
            else if (opts?.auto) return { isPlaying: false, positionMs: 0 }; // fim da fila
            else return {};
          }
          return { currentIndex: nextIndex, loadId: s.loadId + 1, autoplay: true, error: null };
        }),

      previous: () =>
        set((s) => {
          if (!s.queue.length) return {};
          let prev = s.currentIndex - 1;
          if (prev < 0) prev = s.repeat === "all" ? s.queue.length - 1 : 0;
          return { currentIndex: prev, loadId: s.loadId + 1, autoplay: true, error: null };
        }),

      setPlayback: (p) => set(p),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: false }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      cycleRepeat: () => set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
      setNotice: (notice) => set({ notice }),
      setError: (error) => set({ error }),
      setQueueOpen: (queueOpen) => set({ queueOpen }),
      setVideoVisible: (videoVisible) => set({ videoVisible }),
    }),
    {
      name: "unified-player",
      storage: createJSONStorage(() => localStorage),
      // Reidratado manualmente no cliente (usePlayerBootstrap) para evitar mismatch de SSR
      skipHydration: true,
      // persiste só o que faz sentido entre sessões
      partialize: (s) => ({
        queue: s.queue,
        currentIndex: s.currentIndex,
        volume: s.volume,
        muted: s.muted,
        repeat: s.repeat,
        videoVisible: s.videoVisible,
      }),
    },
  ),
);

export const selectCurrentTrack = (s: PlayerState): QueueItem | null => s.queue[s.currentIndex] ?? null;
