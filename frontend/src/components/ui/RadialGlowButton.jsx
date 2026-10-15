import React, { useRef } from "react";
import { Link } from "react-router-dom";
import styles from "./RadialGlowButton.module.css";
import { cn } from "../../lib/utils";

/**
 * RadialGlowButton - Vengeance UI inspired animated button
 * Adapts to Sangam Coral/Ember color tokens
 */
export function RadialGlowButton({
  children,
  to,
  href,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  type = "button",
  ...props
}) {
  const buttonRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    buttonRef.current.style.setProperty("--mouse-x", `${x}%`);
    buttonRef.current.style.setProperty("--mouse-y", `${y}%`);
  };

  const wrapperClass = cn(
    styles.glowButtonWrapper,
    variant === "secondary" && styles.secondaryVariant,
    disabled && styles.disabled,
    className
  );

  if (to) {
    return (
      <Link
        to={to}
        ref={buttonRef}
        onMouseMove={handleMouseMove}
        className={wrapperClass}
        {...props}
      >
        <span className={styles.glowLayer} aria-hidden="true" />
        <span className={styles.buttonBase}>{children}</span>
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        ref={buttonRef}
        onMouseMove={handleMouseMove}
        className={wrapperClass}
        {...props}
      >
        <span className={styles.glowLayer} aria-hidden="true" />
        <span className={styles.buttonBase}>{children}</span>
      </a>
    );
  }

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      className={wrapperClass}
      {...props}
    >
      <span className={styles.glowLayer} aria-hidden="true" />
      <span className={styles.buttonBase}>{children}</span>
    </button>
  );
}

export default RadialGlowButton;
