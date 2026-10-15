import React, { useState } from "react";
import styles from "../styles/videoComponent.module.css";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "🔥", "🙌", "🚀", "💡", "👋"];

const EMOJI_CATEGORIES = {
  Reactions: ["👍", "👎", "❤️", "🔥", "🎉", "👏", "🙌", "✨", "💯", "🚀"],
  Smiles: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😎"],
  Gestures: ["👋", "✋", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "🙏"],
  Objects: ["💡", "💻", "📱", "🔔", "⭐", "☕", "🍕", "🎯", "📊", "🔒", "🔑", "⚡"],
};

export const parseEmojiShortcodes = (text) => {
  if (!text) return "";
  const shortcodes = {
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

  let parsed = text;
  for (const [code, emoji] of Object.entries(shortcodes)) {
    parsed = parsed.replaceAll(code, emoji);
  }
  return parsed;
};

export default function EmojiPicker({ onSelectEmoji, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("Reactions");
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const currentList = EMOJI_CATEGORIES[activeTab] || [];
  const filteredList = search
    ? Object.values(EMOJI_CATEGORIES)
        .flat()
        .filter((e) => e.includes(search))
    : currentList;

  return (
    <div className={styles.emojiPickerCard} role="dialog" aria-label="Emoji Picker">
      <div className={styles.emojiQuickRow}>
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.emojiQuickBtn}
            onClick={() => onSelectEmoji(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className={styles.emojiSearchRow}>
        <input
          type="text"
          className={styles.emojiSearchInput}
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!search && (
        <div className={styles.emojiTabRow}>
          {Object.keys(EMOJI_CATEGORIES).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.emojiTabBtn} ${activeTab === cat ? styles.emojiTabActive : ""}`}
              onClick={() => setActiveTab(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className={styles.emojiGrid}>
        {filteredList.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            className={styles.emojiItemBtn}
            onClick={() => onSelectEmoji(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
