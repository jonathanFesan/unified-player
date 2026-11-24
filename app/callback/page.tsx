"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { exchangeCodeForToken } from "@/lib/spotify/auth";
import { useAuthStore } from "@/lib/store/auth-store";

/** Recebe o redirect do Spotify (?code=...&state=...) e troca o code por tokens. */
function CallbackHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const denied = params.get("error");
    if (denied) {
      setError(denied === "access_denied" ? "Você cancelou a autorização no Spotify." : `Spotify retornou: ${denied}`);
      return;
    }
    if (!code) {
      setError("Nenhum código de autorização recebido.");
      return;
    }
    exchangeCodeForToken(code, params.get("state"))
      .then(() => useAuthStore.getState().init())
      .then(() => router.replace("/"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [params, router]);

  if (error) {
    return (
      <div className="glass max-w-md space-y-4 rounded-2xl p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-amber-400" />
        <p className="text-sm text-zinc-300">{error}</p>
        <Link href="/" className="inline-block rounded-full btn-brand px-4 py-2 text-sm font-bold">
          Voltar
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-zinc-400">
      <Loader2 className="size-5 animate-spin" /> Conectando ao Spotify…
    </div>
  );
}

export default function CallbackPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Suspense fallback={<Loader2 className="size-5 animate-spin text-zinc-400" />}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
