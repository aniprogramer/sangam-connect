import { useState, useEffect, useRef } from "react";

/**
 * useNetworkDiagnostics
 * Gathers real-time WebRTC stats and browser network telemetry.
 *
 * @param {React.MutableRefObject<Object>} connectionsRef - Map of socketId -> RTCPeerConnection (optional)
 * @param {Object} options
 * @param {number} options.pollIntervalMs - Polling interval in ms (default: 2000)
 */
export function useNetworkDiagnostics(connectionsRef = null, { pollIntervalMs = 2000 } = {}) {
  const [metrics, setMetrics] = useState({
    quality: "Good", // "Good" | "Degraded" | "Poor" | "Reconnecting" | "Offline"
    rtt: 0, // ms
    packetLoss: 0, // %
    jitter: 0, // ms
    bitrateDown: 0, // kbps
    bitrateUp: 0, // kbps
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    effectiveType: "4g",
    activePeersCount: 0,
  });

  const prevStatsRef = useRef({
    timestamp: Date.now(),
    bytesReceived: 0,
    bytesSent: 0,
    packetsReceived: 0,
    packetsLost: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const handleOnline = () => {
      if (isMounted) setMetrics((m) => ({ ...m, isOnline: true }));
    };
    const handleOffline = () => {
      if (isMounted) setMetrics((m) => ({ ...m, isOnline: false, quality: "Offline" }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const pollStats = async () => {
      if (!isMounted) return;

      const isOnline = navigator.onLine;
      if (!isOnline) {
        setMetrics((m) => ({ ...m, isOnline: false, quality: "Offline" }));
        return;
      }

      const connInfo =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
      const effectiveType = connInfo?.effectiveType || "4g";

      const pcs = connectionsRef?.current
        ? Object.values(connectionsRef.current).filter(
            (pc) => pc && pc.connectionState !== "closed"
          )
        : [];

      // Idle / Dashboard mode (no active WebRTC peer connections)
      if (pcs.length === 0) {
        const estRtt = connInfo?.rtt || 25;
        const downlink = connInfo?.downlink || 10;
        let quality = "Good";
        if (estRtt > 300 || downlink < 1) quality = "Poor";
        else if (estRtt > 150 || downlink < 3) quality = "Degraded";

        if (isMounted) {
          setMetrics({
            quality,
            rtt: estRtt,
            packetLoss: 0,
            jitter: 0,
            bitrateDown: Math.round(downlink * 1000),
            bitrateUp: Math.round((downlink / 2) * 1000),
            isOnline: true,
            effectiveType,
            activePeersCount: 0,
          });
        }
        return;
      }

      // Check reconnecting states
      const isReconnecting = pcs.some(
        (pc) =>
          pc.connectionState === "connecting" ||
          pc.iceConnectionState === "checking" ||
          pc.iceConnectionState === "disconnected"
      );

      let maxRtt = 0;
      let totalJitter = 0;
      let jitterCount = 0;
      let totalBytesReceived = 0;
      let totalBytesSent = 0;
      let totalPacketsReceived = 0;
      let totalPacketsLost = 0;

      for (const pc of pcs) {
        if (typeof pc.getStats !== "function") continue;
        try {
          const stats = await pc.getStats();
          const reports = stats?.values ? Array.from(stats.values()) : (Array.isArray(stats) ? stats : []);
          for (const report of reports) {
            if (
              report.type === "candidate-pair" &&
              (report.state === "succeeded" || report.selected)
            ) {
              const rttMs = (report.currentRoundTripTime || 0) * 1000;
              if (rttMs > maxRtt) maxRtt = rttMs;
            } else if (report.type === "inbound-rtp") {
              totalBytesReceived += report.bytesReceived || 0;
              totalPacketsReceived += report.packetsReceived || 0;
              totalPacketsLost += report.packetsLost || 0;
              if (typeof report.jitter === "number") {
                totalJitter += report.jitter * 1000;
                jitterCount++;
              }
            } else if (report.type === "outbound-rtp") {
              totalBytesSent += report.bytesSent || 0;
            }
          }
        } catch (_) {}
      }

      const now = Date.now();
      const prev = prevStatsRef.current;
      const timeDeltaSec = Math.max((now - prev.timestamp) / 1000, 0.5);

      const bitrateDown = Math.max(
        0,
        Math.round(((totalBytesReceived - prev.bytesReceived) * 8) / (timeDeltaSec * 1000))
      );
      const bitrateUp = Math.max(
        0,
        Math.round(((totalBytesSent - prev.bytesSent) * 8) / (timeDeltaSec * 1000))
      );

      const packetsLostDelta = Math.max(0, totalPacketsLost - prev.packetsLost);
      const packetsReceivedDelta = Math.max(0, totalPacketsReceived - prev.packetsReceived);
      const totalDelta = packetsLostDelta + packetsReceivedDelta;
      const packetLossPercent =
        totalDelta > 0 ? (packetsLostDelta / totalDelta) * 100 : 0;

      const avgJitter = jitterCount > 0 ? Math.round(totalJitter / jitterCount) : 0;
      const finalRtt = Math.round(maxRtt);

      prevStatsRef.current = {
        timestamp: now,
        bytesReceived: totalBytesReceived,
        bytesSent: totalBytesSent,
        packetsReceived: totalPacketsReceived,
        packetsLost: totalPacketsLost,
      };

      let quality = "Good";
      if (isReconnecting) {
        quality = "Reconnecting";
      } else if (finalRtt > 300 || packetLossPercent > 5 || avgJitter > 50) {
        quality = "Poor";
      } else if (finalRtt > 150 || packetLossPercent > 2 || avgJitter > 30) {
        quality = "Degraded";
      }

      if (isMounted) {
        setMetrics({
          quality,
          rtt: finalRtt,
          packetLoss: Math.round(packetLossPercent * 10) / 10,
          jitter: avgJitter,
          bitrateDown,
          bitrateUp,
          isOnline: true,
          effectiveType,
          activePeersCount: pcs.length,
        });
      }
    };

    pollStats();
    const intervalId = setInterval(pollStats, pollIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connectionsRef, pollIntervalMs]);

  return metrics;
}

export default useNetworkDiagnostics;
