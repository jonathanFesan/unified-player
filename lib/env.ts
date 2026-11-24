/**
 * Variáveis públicas. O Next.js substitui `process.env.NEXT_PUBLIC_*` em build,
 * por isso cada uma precisa ser referenciada de forma literal.
 */
export const env = {
  spotifyClientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "",
  spotifyRedirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ?? "",
  youtubeApiKey: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "",
};

export const isSpotifyConfigured = () => Boolean(env.spotifyClientId && env.spotifyRedirectUri);
export const isYouTubeConfigured = () => Boolean(env.youtubeApiKey);
