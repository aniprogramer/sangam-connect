import React from "react";

/**
 * Lightweight, accessible skeleton placeholder with pulse animation.
 */
export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "6px",
  style = {},
  className = "",
}) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))",
        opacity: 0.6,
        animation: "skeletonPulse 1.6s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export default Skeleton;
