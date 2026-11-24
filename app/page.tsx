"use client";

import { Disc3 } from "lucide-react";
import { Library } from "@/components/Library";
import { PlayerBar } from "@/components/PlayerBar";
import { QueuePanel } from "@/components/QueuePanel";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { SpotifyAccount } from "@/components/SpotifyAccount";
import { StatusToast } from "@/components/StatusToast";
import { Welcome } from "@/components/Welcome";
import { YouTubeHost } from "@/components/YouTubeHost";
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch";
import { useAuthStore } from "@/lib/store/auth-store";

export default function Home() {
  const { query, spotify, youtube, search } = useUnifiedSearch();
  const loggedIn = useAuthStore((s) => s.status === "authenticated");
  const loading = spotify.status === "loading" || youtube.status === "loading";

  return (
    <div className="min-h-dvh pb-28 md:pb-32">
      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 sm:px-6">
          <button
            type="button"
            onClick={() => search("")}
            className="flex shrink-0 items-center gap-2 font-bold tracking-tight"
            aria-label="Início"
          >
            <Disc3 className="size-7 text-spotify" />
            <span className="hidden sm:inline">
              Unified<span className="text-zinc-500">Player</span>
            </span>
          </button>
          <div className="mx-auto w-full max-w-2xl">
            <SearchBar onSearch={search} loading={loading} />
          </div>
          <SpotifyAccount />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-3 pt-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0">
          {query ? <SearchResults query={query} spotify={spotify} youtube={youtube} /> : loggedIn ? (
            <Library />
          ) : (
            <Welcome />
          )}
        </main>
        <QueuePanel />
      </div>

      <YouTubeHost />
      <StatusToast />
      <PlayerBar />
    </div>
  );
}
