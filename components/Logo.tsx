import { useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Símbolo da UPlayed: um "U" feito de uma fita contínua e aberta (pontas soltas embaixo),
 * com as conchas de um fone de ouvido em meia-lua nas laterais.
 * Gradiente do verde profundo (embaixo/esquerda) ao menta (em cima/direita), como na logo.
 */
export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  const id = useId();
  const ribbon = `${id}-ribbon`;
  const cupL = `${id}-cup-l`;
  const cupR = `${id}-cup-r`;
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className} {...props}>
      <defs>
        <linearGradient id={ribbon} x1="10" y1="44" x2="54" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1c8a4e" />
          <stop offset="0.55" stopColor="#5ad67c" />
          <stop offset="1" stopColor="#c7f8cd" />
        </linearGradient>
        <linearGradient id={cupL} x1="0" y1="20" x2="0" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5cf27a" />
          <stop offset="1" stopColor="#0d6b45" />
        </linearGradient>
        <linearGradient id={cupR} x1="0" y1="20" x2="0" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5cf27a" />
          <stop offset="1" stopColor="#0d6b45" />
        </linearGradient>
      </defs>
      <path d="M37 56.5 Q31 56.6 26.5 53.6 A17 17 0 0 1 13 36 V13.5 A4.5 4.5 0 0 1 22 13.5 V36 A14.5 14.5 0 0 0 51 36 V13.5 A4.5 4.5 0 0 0 42 13.5 V38 Q42 46 34.5 47.5" stroke={`url(#${ribbon})`} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20.5 V37.5 A8.5 8.5 0 0 1 9.5 20.5 Z" fill={`url(#${cupL})`} />
      <path d="M54.5 20.5 V37.5 A8.5 8.5 0 0 0 54.5 20.5 Z" fill={`url(#${cupR})`} />
    </svg>
  );
}

/** Símbolo + nome "UPlayed". */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-9 drop-shadow-[0_0_10px_rgb(121_231_126/0.35)]" />
      {showName && (
        <span className="font-display text-xl font-semibold tracking-tight">
          <span className="text-brand-300">U</span>
          <span className="text-brand-100">Played</span>
        </span>
      )}
    </span>
  );
}
