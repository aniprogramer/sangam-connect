import React from "react";
import styles from "./BorderBeam.module.css";
import { cn } from "../../lib/utils";

/**
 * BorderBeam - Vengeance UI animated border beam
 */
export function BorderBeam({
  size = 180,
  duration = 8,
  delay = 0,
  colorFrom = "var(--accent, #FF7A59)",
  colorTo = "var(--idle, #F5C451)",
  borderRadius = "14px",
  className = "",
}) {
  return (
    <div className={cn(styles.borderBeamWrapper, className)} aria-hidden="true">
      <div
        className={styles.beamLine}
        style={{
          "--size": `${size}px`,
          "--duration": `${duration}s`,
          "--delay": `${delay}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--radius": borderRadius,
        }}
      />
    </div>
  );
}

export default BorderBeam;
