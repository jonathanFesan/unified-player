"use client";

import { AlertCircle, SearchX } from "lucide-react";
import { useState } from "react";
import { SpotifyIcon, YouTubeIcon } from "@/components/icons";
import { TrackRow } from "@/components/TrackRow";
import { cn } from "@/lib/utils";
import type { SourceSearchState, TrackSource } from "@/types";

type Tab = "all" | TrackSource;

interface Props {
  query: string;
  spotify: SourceSearchState;
  youtube: SourceSearchState;
}

const SOURCE_META = {
  spotify: { label: "Spotify", Icon: SpotifyIcon, color: "text-spotify", ring: "bg-spotify" },
  youtube: { label: "YouTube", Icon: YouTubeIcon, color: "text-youtube", ring: "bg-youtube" },
} as const;

function Skeleton() {
  return (
    <ul className="space-y-1">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 p-2">
          <div className="size-12 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SourceColumn({ source, state, showHeader }: { source: TrackSource; state: SourceSearchState; showHeader: boolean }) {
  const { label, Icon, color } = SOURCE_META[source];
  return (
    <section className="glass min-w-0 rounded-2xl p-2 sm:p-3" aria-label={`Resultados do ${label}`}>
      {showHeader && (
        <header className="flex items-center gap-2 px-2 pt-1 pb-2">
          <Icon className={cn("size-5", color)} />
          <h2 className="text-sm font-semibold">{label}</h2>
          {state.status === "success" && (
            <span className="text-xs text-zinc-500">{state.results.length} resultados</span>
          )}
        </header>
      )}

      {state.status === "loading" && <Skeleton />}

      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-4 text-sm text-zinc-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p>{state.error}</p>
        </div>
      )}

      {state.status === "success" && state.results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-zinc-500">
          <SearchX className="size-6" />
          Nenhum resultado.
        </div>
      )}

      {state.status === "success" && state.results.length > 0 && (
        <ul className="space-y-0.5">
          {state.results.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SearchResults({ query, spotify, youtube }: Props) {
  const [tab, setTab] = useState<Tab>("all");

  const count = (s: SourceSearchState) => (s.status === "success" ? s.results.length : null);
  const tabs: { id: Tab; label: string; n: number | null; dot?: string }[] = [
    { id: "all", label: "Tudo", n: null },
    { id: "spotify", label: "Spotify", n: count(spotify), dot: "bg-spotify" },
    { id: "youtube", label: "YouTube", n: count(youtube), dot: "bg-youtube" },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          Resultados para <span className="text-zinc-400">“{query}”</span>
        </h1>
        <div role="tablist" className="glass flex rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                tab === t.id ? "btn-brand font-bold" : "text-zinc-400 hover:text-white",
              )}
            >
              {t.dot && <span className={cn("size-1.5 rounded-full", t.dot)} />}
              {t.label}
              {t.n !== null && <span className="opacity-60">{t.n}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-4", tab === "all" && "lg:grid-cols-2")}>
        {(tab === "all" || tab === "spotify") && <SourceColumn source="spotify" state={spotify} showHeader />}
        {(tab === "all" || tab === "youtube") && <SourceColumn source="youtube" state={youtube} showHeader />}
      </div>
    </div>
  );
}
