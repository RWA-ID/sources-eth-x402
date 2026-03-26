"use client";

import { useState } from "react";

interface StarRatingProps {
  avg: number;
  count: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  size?: "sm" | "md";
}

export function StarRating({ avg, count, interactive = false, onRate, size = "sm" }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const display = hovered || avg;
  const starSize = size === "sm" ? "text-sm" : "text-xl";

  const handleClick = (star: number) => {
    if (!interactive || submitted) return;
    setSubmitted(true);
    onRate?.(star);
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(display);
          return (
            <span
              key={star}
              className={`${starSize} transition-colors ${
                interactive && !submitted ? "cursor-pointer" : ""
              } ${filled ? "text-yellow-400" : "text-white/20"}`}
              onMouseEnter={() => interactive && !submitted && setHovered(star)}
              onMouseLeave={() => interactive && !submitted && setHovered(0)}
              onClick={() => handleClick(star)}
            >
              ★
            </span>
          );
        })}
      </div>
      {count > 0 && (
        <span className="text-xs text-white/30">
          {avg.toFixed(1)} ({count})
        </span>
      )}
      {count === 0 && !interactive && (
        <span className="text-xs text-white/20">No ratings</span>
      )}
      {submitted && (
        <span className="text-xs text-[#4fd8b8]">Thanks!</span>
      )}
    </div>
  );
}
