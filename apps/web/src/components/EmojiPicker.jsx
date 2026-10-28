import React, { useState } from "react";
import styles from "../styles/videoComponent.module.css";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "🔥", "🙌", "🚀", "💡", "👋"];

const EMOJI_CATEGORIES = {
  Reactions: ["👍", "👎", "❤️", "🔥", "🎉", "👏", "🙌", "✨", "💯", "🚀"],
  Smiles: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😎"],
  Gestures: ["👋", "✋", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "🙏"],
  Objects: ["💡", "💻", "📱", "🔔", "⭐", "☕", "🍕", "🎯", "📊", "🔒", "🔑", "⚡"],
};

export { parseEmojiShortcodes } from "@sangam/shared";

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
