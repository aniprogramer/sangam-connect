/**
 * formatDate.js — Localized date-time formatter for meeting histories.
 *
 * @param {string|Date} dateInput
 * @returns {string} Formatted date string (e.g., "Oct 16, 05:30 PM")
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return "";

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default formatDate;
