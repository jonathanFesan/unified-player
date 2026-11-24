// Callbacks globais esperados pelos scripts externos dos players.
// (Tipos de `YT` e `Spotify` vêm de @types/youtube e @types/spotify-web-playback-sdk.)
export {};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}
