import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
};

/**
 * Mobile-friendly quantity selector.
 * - Uses type="text" + inputMode="numeric" (avoids iOS number input quirks).
 * - Keeps a local text state so the field can be temporarily empty while typing.
 * - Normalizes on blur (empty/invalid -> min).
 * - Buttons are type="button" (no accidental form submit) and >= 44px touch target.
 */
export function QuantitySelector({
  value,
  min = 1,
  max = 9999,
  onChange,
  className = "",
  ariaLabel = "Quantidade",
}: Props) {
  const safeMin = Math.max(1, Math.floor(min));
  const [text, setText] = useState(String(value ?? safeMin));

  // Sync external value changes (e.g. loaded from DB), but not while user is mid-edit with empty field.
  useEffect(() => {
    setText(String(value ?? safeMin));
  }, [value, safeMin]);

  const commit = (n: number) => {
    const clamped = Math.min(max, Math.max(safeMin, Math.floor(n)));
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const dec = () => commit((Number(value) || safeMin) - 1);
  const inc = () => commit((Number(value) || safeMin) + 1);

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={dec}
        disabled={(Number(value) || safeMin) <= safeMin}
        aria-label="Diminuir quantidade"
        className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={text}
        aria-label={ariaLabel}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          setText(digits);
          if (digits !== "") {
            const n = Number(digits);
            if (Number.isInteger(n) && n >= safeMin && n <= max) onChange(n);
          }
        }}
        onBlur={() => {
          const n = Number(text);
          const safe = Number.isInteger(n) && n >= safeMin ? Math.min(max, n) : safeMin;
          setText(String(safe));
          if (safe !== value) onChange(safe);
        }}
        className="text-center rounded-md border border-border bg-background text-foreground"
        style={{ minHeight: 44, width: 56, fontSize: 16 }}
      />
      <button
        type="button"
        onClick={inc}
        disabled={(Number(value) || safeMin) >= max}
        aria-label="Aumentar quantidade"
        className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
