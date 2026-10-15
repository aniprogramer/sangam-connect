/**
 * roomUtils.js — Utilities for room code extraction and clipboard copying.
 */

/**
 * Extracts and sanitizes the room code from a URL parameter or full URL string.
 * Ensures that only the identifier (e.g., "sangam-g95wan") is copied or used,
 * rather than the full URL (e.g., "https://sangamconnect.com/sangam-g95wan").
 *
 * @param {string} [urlParam] - The route parameter from useParams()
 * @param {string} [fullUrl] - Optional window.location.href or custom URL
 * @returns {string} Sanitized room code
 */
export const extractRoomCode = (urlParam, fullUrl = "") => {
  if (urlParam && typeof urlParam === "string" && urlParam.trim()) {
    const trimmed = urlParam.trim();
    // If urlParam is a full URL or contains slashes, extract last non-empty segment
    const segment = trimmed.split("/").filter(Boolean).pop();
    if (segment) {
      // Strip potential query parameters or hashes
      return segment.split("?")[0].split("#")[0];
    }
  }

  if (fullUrl && typeof fullUrl === "string" && fullUrl.trim()) {
    try {
      const parsed = new URL(fullUrl, "http://localhost");
      const segment = parsed.pathname.split("/").filter(Boolean).pop();
      if (segment) {
        return segment;
      }
    } catch {
      const segment = fullUrl.trim().split("/").filter(Boolean).pop();
      if (segment) {
        return segment.split("?")[0].split("#")[0];
      }
    }
  }

  return "sangam-meet";
};

/**
 * Copies plain text to the clipboard with fallback for unsupported environments.
 *
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if copy succeeded
 */
export const copyToClipboard = async (text) => {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback using textarea + document.execCommand
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
};
