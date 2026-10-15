# Font Palette

A type system for a community-focused voice and video app. The display face has some character, the body face stays legible at small sizes in dense chat and member lists, and a monospace face handles timestamps, room codes, and invite links.

## Font Stack

| Role | Font | Why |
|---|---|---|
| Display / headings | Bricolage Grotesque | Warm and characterful without being distracting. Suits server names, modal titles, and the join screen. |
| Body / UI | Instrument Sans | Clean and compact, legible at 13–14px in chat messages and member lists. |
| Mono | JetBrains Mono | Timestamps, room codes, invite links, and code blocks. |

All three are available on Google Fonts.

## Type Scale

| Token | Size / Line height | Use |
|---|---|---|
| `display` | 40px / 1.05 | Landing and join screens |
| `h1` | 28px / 1.15 | Page or server title |
| `h2` | 20px / 1.2 | Modal and panel titles |
| `body` | 15px / 1.5 | Chat messages, descriptions |
| `ui` | 13px / 1.4 | Channel names, member names, buttons |
| `caption` | 11px / 1.3 | Timestamps, status labels, uppercase section labels with 0.06em tracking |

## Pairing Notes

- **Use the `ui` size for dense lists.** Member and channel lists read cleaner at 13px with medium weight (500) than at body size.
- **Keep Bricolage out of small text.** Its character shows at display sizes and gets busy in paragraphs.
- **Use tabular numbers for counts and timers.** Add `font-variant-numeric: tabular-nums` to call durations and participant counts so they don't shift as digits change.
- **Palette pairing.** The ember palette suits Bricolage's warmth. The teal palette may look better with a more neutral display face such as Manrope.
