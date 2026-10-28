/**
 * parseEmojiShortcodes.js — Fast emoji shortcode replacement utility.
 */

const SHORTCODE_MAP = {
  ":smile:": "😊",
  ":joy:": "😂",
  ":heart:": "❤️",
  ":thumbsup:": "👍",
  ":+1:": "👍",
  ":thumbsdown:": "👎",
  ":-1:": "👎",
  ":fire:": "🔥",
  ":tada:": "🎉",
  ":clap:": "👏",
  ":rocket:": "🚀",
  ":wave:": "👋",
  ":pray:": "🙏",
  ":100:": "💯",
  ":star:": "⭐",
  ":idea:": "💡",
  ":)": "😊",
  ":D": "😃",
  ":(": "🙁",
  "<3": "❤️",
};

/**
 * Parses and replaces common emoji shortcodes and text emoticons with UTF-8 emojis.
 *
 * @param {string} text
 * @returns {string}
 */
export const parseEmojiShortcodes = (text) => {
  if (!text || typeof text !== "string") return "";

  let parsed = text;
  for (const [code, emoji] of Object.entries(SHORTCODE_MAP)) {
    parsed = parsed.replaceAll(code, emoji);
  }
  return parsed;
};

export default parseEmojiShortcodes;
