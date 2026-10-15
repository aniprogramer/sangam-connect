import React, { useState, useRef, useEffect } from "react";
import styles from "./NetworkStatusBadge.module.css";
import useNetworkDiagnostics from "../hooks/useNetworkDiagnostics";

/**
 * NetworkStatusBadge
 * Visual network quality badge with expandable diagnostics telemetry popover.
 *
 * @param {React.MutableRefObject<Object>} connectionsRef - Optional active peer connections ref
 */
export function NetworkStatusBadge({ connectionsRef = null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const metrics = useNetworkDiagnostics(connectionsRef);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const getStatusClass = (quality) => {
    switch (quality) {
      case "Good":
        return styles.statusGood;
      case "Degraded":
        return styles.statusDegraded;
      case "Poor":
        return styles.statusPoor;
      case "Reconnecting":
        return styles.statusReconnecting;
      case "Offline":
      default:
        return styles.statusOffline;
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.badgeBtn}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Network status: ${metrics.quality}. Click for details.`}
        title="Network diagnostics"
      >
        <span
          className={`${styles.statusDot} ${getStatusClass(metrics.quality)}`}
        />
        <span>{metrics.quality}</span>
      </button>

      {open && (
        <div className={styles.telemetryPopover} role="region" aria-label="Network Metrics">
          <div className={styles.popoverHeader}>
            <span>Network Diagnostics</span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--accent, #FF7A59)",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {metrics.quality}
            </span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Latency (RTT):</span>
            <span className={styles.metricValue}>{metrics.rtt} ms</span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Packet Loss:</span>
            <span className={styles.metricValue}>{metrics.packetLoss}%</span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Jitter:</span>
            <span className={styles.metricValue}>{metrics.jitter} ms</span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Download:</span>
            <span className={styles.metricValue}>{metrics.bitrateDown} kbps</span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Upload:</span>
            <span className={styles.metricValue}>{metrics.bitrateUp} kbps</span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Peers Connected:</span>
            <span className={styles.metricValue}>{metrics.activePeersCount}</span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Network:</span>
            <span className={styles.metricValue}>{metrics.effectiveType.toUpperCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkStatusBadge;
