"use client";

import { useEffect } from "react";
import { playerController } from "@/lib/player/controller";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePlaylistStore } from "@/lib/store/playlist-store";
import { selectCurrentTrack, usePlayerStore } from "@/lib/store/player-store";

/** Comandos de transporte — expostos para qualquer componente. */
export const playerActions = {
  togglePlay: () => playerController.togglePlay(),
  next: () => playerController.next(),
  previous: () => playerController.previous(),
  seek: (ms: number) => playerController.seek(ms),
};

/**
 * Inicializa o controller, a sessão do Spotify, atalhos de teclado e a
 * Media Session API (controles na tela de bloqueio / teclas de mídia).
 * Deve ser montado UMA vez (em <Providers/>).
 */
export function usePlayerBootstrap() {
  const isPremium = useAuthStore((s) => s.isPremium);
  const status = useAuthStore((s) => s.status);
  const current = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    void usePlayerStore.persist.rehydrate();
    void usePlaylistStore.persist.rehydrate();
    playerController.init();
    void useAuthStore.getState().init();
  }, []);

  // Premium: conecta o Web Playback SDK antecipadamente
  useEffect(() => {
    if (status === "authenticated" && isPremium) playerController.warmUpSpotify();
  }, [status, isPremium]);

  // Atalhos: Espaço = play/pause, Shift+→ / Shift+← = próxima/anterior
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable=true]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        playerActions.togglePlay();
      } else if (e.shiftKey && e.code === "ArrowRight") {
        playerActions.next();
      } else if (e.shiftKey && e.code === "ArrowLeft") {
        playerActions.previous();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Media Session
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => playerActions.togglePlay());
    ms.setActionHandler("pause", () => playerActions.togglePlay());
    ms.setActionHandler("nexttrack", () => playerActions.next());
    ms.setActionHandler("previoustrack", () => playerActions.previous());
    ms.setActionHandler("seekto", (d) => d.seekTime != null && playerActions.seek(d.seekTime * 1000));
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = current
      ? new MediaMetadata({
          title: current.title,
          artist: current.artist,
          album: current.album ?? (current.source === "youtube" ? "YouTube" : "Spotify"),
          artwork: current.artwork ? [{ src: current.artwork, sizes: "512x512" }] : [],
        })
      : null;
  }, [current]);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Título da aba
  useEffect(() => {
    document.title = current ? `${isPlaying ? "▶ " : ""}${current.title} · ${current.artist}` : "UPlayed";
  }, [current, isPlaying]);
}
