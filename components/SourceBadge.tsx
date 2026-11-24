import { SpotifyIcon, YouTubeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { TrackSource } from "@/types";

interface Props {
  source: TrackSource;
  /** Exibe só o ícone (para espaços pequenos) */
  compact?: boolean;
  className?: string;
}

export function SourceBadge({ source, compact, className }: Props) {
  const isSpotify = source === "spotify";
  const Icon = isSpotify ? SpotifyIcon : YouTubeIcon;
  const label = isSpotify ? "Spotify" : "YouTube";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium",
        compact ? "p-0.5" : "px-2 py-0.5 text-[10px] uppercase tracking-wide ring-1",
        isSpotify ? "text-spotify ring-spotify/30 bg-spotify/10" : "text-youtube ring-youtube/30 bg-youtube/10",
        compact && "bg-transparent",
        className,
      )}
    >
      <Icon className={compact ? "size-3.5" : "size-3"} />
      {!compact && label}
    </span>
  );
}
