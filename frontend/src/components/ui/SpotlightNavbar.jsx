import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import styles from "./SpotlightNavbar.module.css";
import { cn } from "../../lib/utils";
import RadialGlowButton from "./RadialGlowButton";
import ThemeToggle from "./ThemeToggle";

/**
 * SpotlightNavbar - Vengeance UI cursor-reactive navigation bar
 * Customized for Sangam Connect branding
 */
export function SpotlightNavbar({
  brandLogo = "/assets/branding/sangam-icon.png",
  brandTitle = "Sangam Connect",
  tagline = "Where Voices Converge",
  links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#workflow" },
    { label: "Security", href: "#security" },
  ],
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinksRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleMouseMove = (e) => {
    if (!navLinksRef.current) return;
    const rect = navLinksRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 45; // center the 90px highlight
    navLinksRef.current.style.setProperty("--spotlight-x", `${x}px`);
    navLinksRef.current.style.setProperty("--spotlight-opacity", "1");
  };

  const handleMouseLeave = () => {
    if (!navLinksRef.current) return;
    navLinksRef.current.style.setProperty("--spotlight-opacity", "0");
  };

  return (
    <nav className={cn(styles.navbar, scrolled && styles.scrolled)}>
      {/* Brand logo & title */}
      <Link to="/" className={styles.brandLink}>
        <img
          src={brandLogo}
          alt="Sangam Connect Logo"
          className={styles.brandLogo}
        />
        <div className={styles.brandTextGroup}>
          <span className={styles.brandTitle}>{brandTitle}</span>
          <span className={styles.brandTagline}>{tagline}</span>
        </div>
      </Link>

      {/* Spotlight nav links group */}
      <div
        ref={navLinksRef}
        className={styles.navLinksGroup}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={styles.spotlightHighlight} aria-hidden="true" />
        {links.map((link, idx) => (
          <a key={idx} href={link.href} className={styles.navLink}>
            {link.label}
          </a>
        ))}
      </div>

      {/* Action buttons */}
      <div className={styles.actionArea}>
        <ThemeToggle />
        <Link
          to="/login"
          className={styles.navLink}
          style={{ color: "var(--text-primary)" }}
        >
          Sign In
        </Link>
        <RadialGlowButton to="/register" variant="primary">
          Get Started
        </RadialGlowButton>

        {/* Mobile menu button */}
        <button
          type="button"
          className={styles.mobileMenuBtn}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle Navigation Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className={styles.mobileDrawer}>
          {links.map((link, idx) => (
            <a
              key={idx}
              href={link.href}
              className={styles.navLink}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/login"
            className={styles.navLink}
            onClick={() => setMobileOpen(false)}
          >
            Sign In
          </Link>
          <RadialGlowButton
            to="/register"
            onClick={() => setMobileOpen(false)}
            style={{ width: "100%" }}
          >
            Get Started
          </RadialGlowButton>
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <ThemeToggle />
          </div>
        </div>
      )}
    </nav>
  );
}

export default SpotlightNavbar;
