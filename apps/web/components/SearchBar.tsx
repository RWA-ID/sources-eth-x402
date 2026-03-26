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
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={q}
          onChange={(e) => handleQuery(e.target.value)}
          placeholder="Search by name, category, agent ID, or wallet address..."
          className="w-full px-5 py-4 bg-[#16161f] border border-white/[0.07] rounded-xl text-white placeholder-white/30 font-display focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all text-base"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>
    </div>
  );
}
