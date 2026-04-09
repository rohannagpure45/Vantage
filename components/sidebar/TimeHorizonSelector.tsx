"use client";

import type { TimeHorizonKey } from "@/lib/types";

interface TimeHorizonSelectorProps {
  selected: TimeHorizonKey | null;
  onChange: (horizon: TimeHorizonKey | null) => void;
  disabled?: boolean;
}

const HORIZONS: { key: TimeHorizonKey; label: string; shortLabel: string }[] = [
  { key: "1_day", label: "1 Day", shortLabel: "1D" },
  { key: "1_week", label: "1 Week", shortLabel: "1W" },
  { key: "1_month", label: "1 Month", shortLabel: "1M" },
  { key: "6_months", label: "6 Months", shortLabel: "6M" },
  { key: "1_year", label: "1 Year", shortLabel: "1Y" },
];

export default function TimeHorizonSelector({
  selected,
  onChange,
  disabled,
}: TimeHorizonSelectorProps) {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5 rounded-lg bg-muted/50 border border-border">
      {HORIZONS.map(({ key, label, shortLabel }) => {
        const isActive = selected === key;
        return (
          <button
            key={key}
            onClick={() => onChange(isActive ? null : key)}
            disabled={disabled}
            title={label}
            className={`
              px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {shortLabel}
          </button>
        );
      })}
    </div>
  );
}
