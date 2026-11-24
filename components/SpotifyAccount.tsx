"use client";

import { Crown, Loader2, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SpotifyIcon } from "@/components/icons";
import { isSpotifyConfigured } from "@/lib/env";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

export function SpotifyAccount() {
  const { status, user, isPremium, sdkReady, login, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (status === "loading") {
    return <Loader2 className="size-5 animate-spin text-zinc-500" aria-label="Carregando" />;
  }

  if (status !== "authenticated" || !user) {
    const configured = isSpotifyConfigured();
    return (
      <button
        type="button"
        onClick={() => void login()}
        disabled={!configured}
        title={configured ? "Conectar ao Spotify" : "Defina NEXT_PUBLIC_SPOTIFY_CLIENT_ID no .env.local"}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-spotify px-4 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-spotify/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      >
        <SpotifyIcon className="size-4" />
        <span className="hidden sm:inline">Conectar Spotify</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1 pr-3 pl-1 text-sm transition hover:bg-white/10"
      >
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-spotify/20 text-xs font-bold text-spotify">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-28 truncate md:inline">{user.displayName}</span>
        <span
          className={cn("size-2 rounded-full", isPremium ? (sdkReady ? "bg-spotify" : "bg-amber-400") : "bg-zinc-500")}
          title={isPremium ? (sdkReady ? "Player conectado" : "Conectando player…") : "Conta Free"}
        />
      </button>

      {open && (
        <div className="glass absolute right-0 z-50 mt-2 w-64 animate-fade-in rounded-2xl p-2 shadow-2xl shadow-black/50">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
              {isPremium ? (
                <>
                  <Crown className="size-3.5 text-amber-300" /> Premium ·{" "}
                  {sdkReady ? "reprodução completa ativa" : "conectando player…"}
                </>
              ) : (
                "Conta Free · prévias de 30s ou fallback no YouTube"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" /> Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
