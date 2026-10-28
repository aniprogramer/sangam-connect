/**
 * getUserInitials.js — Extracts up to 2 uppercase initials from a user's display name.
 *
 * @param {string} [name]
 * @returns {string} 2-letter uppercase initials
 */
export const getUserInitials = (name) => {
  if (!name || typeof name !== "string") return "SC";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0] || "SC").toUpperCase();
};

export default getUserInitials;
