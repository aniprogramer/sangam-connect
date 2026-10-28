/**
 * audioUtils.js — Deterministic, safe AudioContext lifecycle management.
 */

/**
 * Safely and idempotently closes an AudioContext instance without throwing.
 *
 * @param {AudioContext|null|undefined} ctx - The AudioContext to close.
 * @returns {Promise<void>} Resolves when closed or immediately if already closed/invalid.
 */
export const safeCloseAudioContext = async (ctx) => {
  if (!ctx || typeof ctx.close !== "function") return;

  if (ctx.state === "closed") return;

  try {
    await ctx.close().catch(() => {});
  } catch (_) {}
};

/**
 * Creates a clean AudioContext instance if supported by the environment.
 *
 * @returns {AudioContext|null}
 */
export const createSafeAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch (err) {
    console.warn("Failed to create AudioContext:", err);
    return null;
  }
};
