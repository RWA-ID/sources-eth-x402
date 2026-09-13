"use client";

import { useState, useCallback, useRef } from "react";

interface SearchBarProps {
  onSearch: (q: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [q, setQ] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQuery = useCallback(
    (value: string) => {
      setQ(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      // Clear immediately, debounce non-empty queries
      timerRef.current = setTimeout(() => onSearch(value), value ? 300 : 0);
    },
    [onSearch]
  );

  return (
    <div className="w-full">
      <div className="relative flex items-center gap-2.5 bg-[#17130f] border border-white/[0.16] rounded-[14px] pl-4 pr-2 focus-within:border-[#f97316]/55 transition-colors">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-[#eef0f6]/40"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => handleQuery(e.target.value)}
          placeholder="Search by name, category, agent ID, or wallet address..."
          className="flex-1 min-w-0 py-4 bg-transparent border-0 text-white placeholder-white/30 font-sans text-base focus:outline-none"
        />
      </div>
    </div>
  );
}
