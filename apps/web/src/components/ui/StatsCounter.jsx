import React, { useEffect, useState, useRef } from "react";
import { cn } from "../../lib/utils";

/**
 * StatsCounter - Vengeance UI numerical counter
 * Adheres to docs/font.md tabular-nums requirement
 */
export function StatsCounter({
  target = 100,
  duration = 1500,
  prefix = "",
  suffix = "",
  className = "",
}) {
  const [count, setCount] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    let animationFrameId;

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      // easeOutCubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeProgress * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return (
    <span
      className={cn("tabular-nums font-mono", className)}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default StatsCounter;
