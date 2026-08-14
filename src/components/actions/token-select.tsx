"use client";

import { TOKEN_LIST, type TokenInfo } from "@/lib/pool";

export function TokenSelect({
  value,
  onChange,
  disabled,
  tokens = TOKEN_LIST,
}: {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
  tokens?: TokenInfo[];
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-graphite-700 bg-graphite-800 p-1">
      {tokens.map((t) => (
        <button
          key={t.symbol}
          type="button"
          disabled={disabled}
          onClick={() => onChange(t.symbol)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            value === t.symbol
              ? "bg-copper-500 text-graphite-950"
              : "text-graphite-300 hover:text-graphite-100"
          }`}
        >
          {t.symbol}
        </button>
      ))}
    </div>
  );
}
