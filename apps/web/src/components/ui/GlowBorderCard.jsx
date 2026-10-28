import React from "react";
import styles from "./GlowBorderCard.module.css";
import { cn } from "../../lib/utils";

/**
 * GlowBorderCard - Vengeance UI interactive card
 * Adapted with Sangam Ember and Warm Charcoal palette
 */
export function GlowBorderCard({
  children,
  className = "",
  innerClassName = "",
  onClick,
  ...props
}) {
  return (
    <div
      className={cn(styles.cardContainer, className)}
      onClick={onClick}
      {...props}
    >
      <div className={styles.glowBorder} aria-hidden="true" />
      <div className={cn(styles.innerContent, innerClassName)}>
        {children}
      </div>
    </div>
  );
}

export default GlowBorderCard;
