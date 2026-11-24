/**
 * Spotify OAuth 2.0 — Authorization Code com PKCE (sem client secret).
 * Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */
import { env } from "@/lib/env";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_SCOPES = [
  "streaming", // Web Playback SDK
  "user-read-email",
  "user-read-private", // necessário para saber se a conta é Premium
  "user-read-playback-state",
  "user-modify-playback-state",
  // Biblioteca: playlists e Músicas Curtidas
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
];

const K = {
  verifier: "sp_pkce_verifier",
  state: "sp_pkce_state",
  tokens: "sp_tokens",
} as const;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

// ---------- PKCE helpers ----------
function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ---------- token storage ----------
function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(K.tokens);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(res: TokenResponse, previousRefresh?: string): StoredTokens {
  const tokens: StoredTokens = {
    accessToken: res.access_token,
    // O Spotify pode (ou não) rotacionar o refresh token
    refreshToken: res.refresh_token ?? previousRefresh ?? "",
    expiresAt: Date.now() + res.expires_in * 1000,
  };
  localStorage.setItem(K.tokens, JSON.stringify(tokens));
  return tokens;
}

export function hasSpotifySession(): boolean {
  return readTokens() !== null;
}

export function clearSpotifySession(): void {
  localStorage.removeItem(K.tokens);
  localStorage.removeItem(K.verifier);
  localStorage.removeItem(K.state);
}

// ---------- login ----------
export async function redirectToSpotifyLogin(): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = await sha256Base64Url(verifier);
  // O verifier fica no storage da ORIGEM atual — por isso o app precisa ser aberto
  // na mesma origem da Redirect URI (ex.: http://127.0.0.1:3000).
  localStorage.setItem(K.verifier, verifier);
  localStorage.setItem(K.state, state);

  const params = new URLSearchParams({
    client_id: env.spotifyClientId,
    response_type: "code",
    redirect_uri: env.spotifyRedirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
  });
  window.location.assign(`${AUTH_URL}?${params}`);
}

/** Troca o `code` do callback por tokens. Idempotente (StrictMode executa efeitos 2x em dev). */
let exchangeInFlight: Promise<void> | null = null;
export function exchangeCodeForToken(code: string, state: string | null): Promise<void> {
  if (exchangeInFlight) return exchangeInFlight;
  exchangeInFlight = (async () => {
    const verifier = localStorage.getItem(K.verifier);
    const expectedState = localStorage.getItem(K.state);
    if (!verifier) {
      throw new Error(
        "code_verifier não encontrado. Abra o app pela MESMA origem da Redirect URI (ex.: http://127.0.0.1:3000) e tente novamente.",
      );
    }
    if (!state || state !== expectedState) throw new Error("Parâmetro `state` inválido (possível CSRF).");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.spotifyClientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.spotifyRedirectUri,
        code_verifier: verifier,
      }),
    });
    if (!res.ok) throw new Error(`Falha ao obter token do Spotify (${res.status}): ${await res.text()}`);
    saveTokens((await res.json()) as TokenResponse);
    localStorage.removeItem(K.verifier);
    localStorage.removeItem(K.state);
  })();
  return exchangeInFlight;
}

// ---------- refresh ----------
let refreshInFlight: Promise<string | null> | null = null;

async function refresh(tokens: StoredTokens): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.spotifyClientId,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  if (!res.ok) {
    clearSpotifySession();
    return null;
  }
  return saveTokens((await res.json()) as TokenResponse, tokens.refreshToken).accessToken;
}

/** Retorna um access token válido (renovando se faltar < 60s), ou null se não logado. */
export async function getSpotifyAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  refreshInFlight ??= refresh(tokens).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
