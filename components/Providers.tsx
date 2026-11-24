"use client";

import { useEffect } from "react";
import { usePlayerBootstrap } from "@/hooks/usePlayer";
import { env } from "@/lib/env";

/** Componente "invisível" que liga o controller, auth e integrações do navegador. */
function PlayerBootstrap() {
  usePlayerBootstrap();
  return null;
}

/**
 * O Spotify exige 127.0.0.1 em vez de localhost na Redirect URI, e o
 * code_verifier do PKCE fica no localStorage da origem. Se o usuário abrir
 * http://localhost:3000, redirecionamos para a origem da Redirect URI.
 */
function useCanonicalOrigin() {
  useEffect(() => {
    if (!env.spotifyRedirectUri) return;
    try {
      const target = new URL(env.spotifyRedirectUri);
      const here = window.location;
      if (here.hostname === "localhost" && target.hostname === "127.0.0.1" && here.port === target.port) {
        here.replace(`${target.origin}${here.pathname}${here.search}${here.hash}`);
      }
    } catch {
      /* URI inválida — ignorado */
    }
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useCanonicalOrigin();
  return (
    <>
      <PlayerBootstrap />
      {children}
    </>
  );
}
