"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  max: number;
  /** Chamado continuamente durante o arraste (opcional) */
  onInput?: (v: number) => void;
  /** Chamado ao soltar — usado no seek para não spammar a API */
  onCommit: (v: number) => void;
  step?: number;
  disabled?: boolean;
  label: string;
  fill?: string;
  className?: string;
  /** Formata o valor para leitores de tela */
  valueText?: (v: number) => string;
}

/** Range input estilizado que mantém valor local durante o arraste. */
export function Slider({ value, max, onInput, onCommit, step = 1, disabled, label, fill, className, valueText }: Props) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? value;
  const pct = max > 0 ? Math.min(100, (shown / max) * 100) : 0;

  const commit = () => {
    if (dragValue !== null) onCommit(dragValue);
    setDragValue(null);
  };

  return (
    <input
      type="range"
      aria-label={label}
      aria-valuetext={valueText?.(shown)}
      min={0}
      max={max || 1}
      step={step}
      value={shown}
      disabled={disabled}
      onChange={(e) => {
        const v = Number(e.target.value);
        setDragValue(v);
        onInput?.(v);
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
      className={cn("range", className)}
      style={{ "--pct": `${pct}%`, ...(fill ? { "--fill": fill } : {}) } as CSSProperties}
    />
  );
}
