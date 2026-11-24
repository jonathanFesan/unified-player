"use client";

import { CheckCircle2, Circle, Layers, Search, Shuffle } from "lucide-react";
import { SpotifyIcon, YouTubeIcon } from "@/components/icons";
import { LogoMark } from "@/components/Logo";
import { isSpotifyConfigured, isYouTubeConfigured } from "@/lib/env";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok ? "text-brand-300" : "text-zinc-600")} />
      <span className={ok ? "text-zinc-300" : "text-zinc-500"}>{children}</span>
    </li>
  );
}

/** Tela inicial: o que o app faz + checklist de configuração. */
export function Welcome() {
  const status = useAuthStore((s) => s.status);
  const isPremium = useAuthStore((s) => s.isPremium);
  const sdkReady = useAuthStore((s) => s.sdkReady);

  const features = [
    { Icon: Search, title: "Busca unificada", text: "Um campo, dois catálogos. Resultados lado a lado." },
    { Icon: Layers, title: "Fila híbrida", text: "Misture faixas do Spotify e vídeos do YouTube." },
    { Icon: Shuffle, title: "Troca automática", text: "O player alterna entre o SDK do Spotify e o IFrame do YouTube." },
  ];

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-8 py-6 sm:py-12">
      <div className="space-y-4 text-center">
        <LogoMark className="mx-auto size-24 drop-shadow-[0_0_28px_rgb(121_231_126/0.35)] sm:size-28" />
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Toda a sua música em <span className="text-brand-gradient">um só player</span>
        </h1>
        <p className="text-zinc-400">
          Busque no Spotify e no YouTube ao mesmo tempo e monte uma fila contínua com as duas fontes.
        </p>
        <div className="flex justify-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full bg-spotify/10 px-3 py-1 text-spotify ring-1 ring-spotify/25">
            <SpotifyIcon className="size-3.5" /> Spotify
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-youtube/10 px-3 py-1 text-youtube ring-1 ring-youtube/25">
            <YouTubeIcon className="size-3.5" /> YouTube
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {features.map(({ Icon, title, text }) => (
          <div key={title} className="glass rounded-2xl p-4">
            <Icon className="mb-2 size-5 text-brand-300" />
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-zinc-400">{text}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-sm font-semibold">Status da configuração</p>
        <ul className="space-y-2 text-sm">
          <Check ok={isSpotifyConfigured()}>
            Client ID do Spotify definido (<code className="text-xs">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code>)
          </Check>
          <Check ok={isYouTubeConfigured()}>
            Chave da YouTube Data API definida (<code className="text-xs">NEXT_PUBLIC_YOUTUBE_API_KEY</code>)
          </Check>
          <Check ok={status === "authenticated"}>Conta do Spotify conectada</Check>
          <Check ok={status === "authenticated" && isPremium && sdkReady}>
            Spotify Premium + Web Playback SDK ativo{" "}
            <span className="text-zinc-600">(opcional — sem ele, prévias de 30s ou fallback pelo YouTube)</span>
          </Check>
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          Dica: pressione <kbd className="rounded border border-white/10 px-1">/</kbd> para buscar e{" "}
          <kbd className="rounded border border-white/10 px-1">Espaço</kbd> para tocar/pausar.
        </p>
      </div>
    </div>
  );
}
