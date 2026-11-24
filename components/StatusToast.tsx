"use client";

import { AlertTriangle, Info, X } from "lucide-react";
import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store/player-store";

/** Exibe erros e avisos do player (ex.: fallback para o YouTube) acima da barra. */
export function StatusToast() {
  const error = usePlayerStore((s) => s.error);
  const notice = usePlayerStore((s) => s.notice);
  const setError = usePlayerStore((s) => s.setError);
  const setNotice = usePlayerStore((s) => s.setNotice);

  // Avisos somem sozinhos; erros ficam até o usuário fechar (ou trocar de faixa)
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const message = error ?? notice;
  if (!message) return null;
  const isError = Boolean(error);

  return (
    <div
      role={isError ? "alert" : "status"}
      className="glass fixed bottom-[84px] left-1/2 z-50 flex w-[min(32rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-slide-up items-start gap-2 rounded-xl px-3 py-2.5 text-sm shadow-xl shadow-black/40 md:bottom-28"
    >
      {isError ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-sky-400" />
      )}
      <p className="flex-1 text-zinc-200">{message}</p>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => (isError ? setError(null) : setNotice(null))}
        className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
