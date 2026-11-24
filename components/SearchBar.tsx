"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  onSearch: (q: string) => void;
  loading?: boolean;
}

/**
 * Busca disparada no Enter (e não a cada tecla) para economizar a cota da
 * YouTube Data API — cada busca custa 100 unidades de 10.000/dia.
 * Atalho: "/" foca a barra.
 */
export function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea")) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value);
        inputRef.current?.blur();
      }}
      className="relative w-full"
    >
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar músicas ou artistas no Spotify e YouTube…"
        aria-label="Buscar músicas ou artistas"
        enterKeyHint="search"
        className="h-11 w-full rounded-full border border-white/10 bg-white/[0.06] pr-24 pl-11 text-sm text-white placeholder:text-zinc-500 transition outline-none focus:border-brand-300/50 focus:bg-white/[0.09] focus:ring-4 focus:ring-brand-300/10 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
        {loading && <Loader2 className="size-4 animate-spin text-zinc-400" />}
        {value && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
        <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500 md:block">/</kbd>
      </div>
    </form>
  );
}
