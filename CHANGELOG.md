# Sangam Connect — Changelog

All notable changes to the Sangam Connect platform are documented in this file.

## [2.4.0] - 2026-10-15

### Authentication Page Light Theme Implementation

- **Visual Fidelity & Aesthetic**:
  - Implemented light-theme layout matching reference image `media_1792064975810.png` with warm off-white/cream background (`#FCF8F4`), soft coral atmospheric glows, and faint dot/grid matrix.
  - Added pure white auth card (`#FFFFFF`) with 28px rounded corners, subtle warm borders, and restrained shadows (`0 20px 48px -8px rgba(50, 30, 20, 0.08)`).
  - Designed segmented tab control with light-peach active tab (`#FDF1EC`), coral border (`#F06A49`), and coral bold text.
  - Implemented "Keep me signed in" checkbox and "Forgot password?" coral link in Sign In mode.
  - Dynamically switched center illustration to feathered `/assets/hero_illustration_light.png` and avatar strip to `/assets/avatars_light.png`.
  - Added scoped light-mode styling for `ThemeToggle` (`#FCF4ED` with amber stroke) and `EN ⌵` language selector pill.
- **Theme Isolation & Regressions**:
  - Strictly isolated light-theme overrides using `:global([data-theme="light"])` selectors and scoped CSS module rules.
  - Dark-theme authentication page remains 100% identical to approved version with zero visual or functional regressions.
- **Testing & Verification**:
  - Added `frontend/src/pages/__tests__/authentication.test.jsx` covering light theme rendering, dark theme rendering, tab switching, and theme toggle interactions.
  - Full test suite passed (7 test suites, 47 tests passed).
  - Production build compiled cleanly with 0 errors and 0 warnings.

## [2.3.0] - 2026-10-15

### Production Reliability, Responsive Meeting UI, Theme System & Network Diagnostics

#### Remediated Issues (5/5)

1. **[ISSUE 1] Meeting Layout & Side-Panel Mutual Exclusivity**
   - Enforced mutual exclusivity between in-call chat (`showModal`) and participants panel (`showParticipants`). Opening one automatically docks and closes the other.
   - Shifted local user picture-in-picture (PIP) tile dynamically (`.meetUserVideoShifted { right: 384px; }`) when a side panel is active on desktop, preventing any overlap of local video or chat content.
   - Added responsive positioning for mobile viewports (`top: 68px; right: 14px;`) so the local preview remains visible above docking panels.
   - Retained `100dvh` shell with zero document scroll and persistent video elements across state transitions.

2. **[ISSUE 2] Application-Wide Theme System (Warm Paper & Charcoal Ember)**
   - Implemented `ThemeContext.jsx` with `ThemeProvider`, `useTheme()`, and persistent storage in `localStorage.getItem("theme")`.
   - Added cross-tab synchronization via `window.addEventListener("storage")` for real-time theme parity across all open tabs.
   - Created accessible `ThemeToggle.jsx` switch button featuring sun/moon iconography.
   - Expanded `palette.css` with light mode shadow tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--accent-glow`, `--glow-accent`) and `--bg-overlay`.
   - Integrated theme switch across Landing navbar (`SpotlightNavbar.jsx`), Dashboard (`home.jsx`), Meeting Lobby, and In-Call meeting header.

3. **[ISSUE 3] Deterministic AudioContext Lifecycle & Crash Elimination**
   - Eliminated runtime error `Cannot close a closed AudioContext` by introducing `safeCloseAudioContext` and `createSafeAudioContext` in `audioUtils.js`.
   - Idempotently checks context state before invoking `close()` (`state !== "closed"`), catches asynchronous promise rejections, and nullifies references immediately.
   - Applied deterministic audio teardown in `VideoMeet.jsx` (audio meter activity, Web Audio chime synthesis, silent dummy stream fallback) and `DeviceSettingsModal.jsx` (microphone level meter, speaker test chime).

4. **[ISSUE 4] Multi-Tab & Multi-Browser Support for Same User Account**
   - Resolved aggressive same-`userId` session eviction in `backend/src/controllers/socketManager.js`.
   - Multiple tabs or browsers logged into the same account can now join calls concurrently with isolated socket transports and peer connections.
   - Added automated backend suite test verifying concurrent multi-session room membership without participant dropouts.

5. **[ISSUE 5] Real-Time WebRTC Network Diagnostics & Telemetry**
   - Implemented `useNetworkDiagnostics.js` polling WebRTC `RTCPeerConnection.getStats()` every 2 seconds during active calls.
   - Measures candidate-pair latency (RTT in ms), inbound packet loss rate (%), jitter (ms), frame drops, and download/upload bitrates (kbps).
   - Computes live connection health rating: `Good`, `Degraded`, `Poor`, `Reconnecting`, or `Offline`.
   - Dashboard/idle mode monitors browser connectivity (`navigator.onLine`, Network Information API `effectiveType`, `downlink`, `rtt`).
   - Created `NetworkStatusBadge.jsx` with color-coded status indicator and interactive popover displaying real-time metrics.
   - Added `/health` backend ping endpoint in `backend/src/app.js`.

---

## [2.2.0] - 2026-10-15

### WebRTC Reliability, Media Controls & Meeting UX Remediation

#### Remediated Issues (10/10)

1. **[ISSUE 1] Local Video Flickering Resolved**
   - Eliminated unconstrained `useEffect` re-binding `srcObject` on every render.
   - Bound video streams using idempotent ref callback (`bindLocalVideo`) checking `el.srcObject !== stream`.
   - Local preview remains rock-solid during chat input, timer ticks, and remote peer joins.

2. **[ISSUE 2] Meeting Layout Fits Within Single Viewport (100dvh)**
   - Converted `.meetVideoContainer` into a strict `height: 100vh; height: 100dvh; max-height: 100dvh; width: 100%; overflow: hidden;` shell.
   - Locked document body scroll while active meeting view is mounted.
   - Introduced `.stageArea` flex container that automatically shrinks the video grid when side panels are toggled.

3. **[ISSUE 3] Robust Screen Sharing with Audio Fallback & Signaling**
   - Added audio capture fallback in `getDisplayMedia` to prevent complete share failure on unsupported OS/browser configs.
   - Replaced video tracks across all active connections using transceiver and sender lookup.
   - Added `media-state` Socket.IO broadcast (`screenSharing: true/false`), allowing remote participants to label and display shared screens accurately.
   - Restored camera track cleanly via `replaceTrack()` upon screen share termination.

4. **[ISSUE 4] Multi-Participant Local Testing & Hardware Contention Handling**
   - Caught `NotReadableError` and `TrackStartError` during local camera acquisition.
   - Added automatic graceful fallback to audio-only participation with informative UI notice when physical webcam is locked by another window.
   - Authored `docs/local-testing-guide.md` documenting Chromium fake media flags, profile separation, and OBS virtual cameras.

5. **[ISSUE 5] Audio & Video Device Settings Modal (`DeviceSettingsModal.jsx`)**
   - Implemented reusable device switcher available in both the Lobby pre-check and active in-call controls.
   - Live camera switcher with test preview box.
   - Microphone selector with live input-level meter using Web Audio API `AnalyserNode`.
   - Audio output selector with `setSinkId` feature detection and a built-in synthesizer test sound.
   - Persists user hardware preferences in `localStorage`.

6. **[ISSUE 6] In-Call Chat Notifications, Side Docking & Emoji Support**
   - Replaced fixed overlay chat with a docked desktop side panel that resizes the video stage without obscuring tiles.
   - Added non-intrusive floating toast notifications and Web Audio synthesized chimes for incoming messages when chat is closed.
   - Implemented `EmojiPicker.jsx` with quick reactions, category tabs, and shortcode parser (`:smile:`, `:heart:`, etc.).
   - Deduplicated messages using stable message IDs.

7. **[ISSUE 7] Duplicate Participants & Stale Session Cleanup**
   - Added deduplication to `connections[path]` in `socketManager.js`.
   - Evicts stale socket IDs when the same authenticated user reconnects or refreshes.
   - Added explicit `leave-call` event emitted on client unmount to avoid ghost participant delays.
   - Client normalizes participants into a deduplicated state map keyed by `socketId`.

8. **[ISSUE 8] Copy Room Code Copies Clean Identifier Only**
   - Implemented `extractRoomCode()` utility in `roomUtils.js` to extract only the room code (e.g., `sangam-g95wan`), not the full URL.
   - Provides clipboard fallback and temporary success feedback.

9. **[ISSUE 9] Interactive Participants Panel (`ParticipantsPanel.jsx`)**
   - Made header participant count badge interactive, toggling the new Participants Panel.
   - Displays real-time participant list, avatars/initials, Member vs. Guest badges, connection status, mic/cam/screen indicators, and "You" tag.

10. **[ISSUE 10] Polished Avatar Placeholder When Camera Is Disabled**
    - Rendered branded avatar tile with initials, participant name, mic icon, and speaking glow rings when video is off.
    - Synchronized camera and speaking states in real time via Socket.IO `media-state` events.

---

## [2.1.0] - 2026-10-15

### WebRTC Reliability Fixes and Architecture Hardening

#### Critical Bug Fixes

**[FIX-BACKEND] Signal Relay — `socket.io` → `socket.id` (socketManager.js L49)**
- **Root cause (confirmed):** Signal messages were relayed with `socket.io` (the Socket.IO
  Manager instance object) as `fromId` instead of `socket.id` (the sender's string socket ID).
  Every receiving client received a corrupt/object `fromId`, causing all peer connection
  identity to break. This was the primary upstream cause of Issues C and D.
- **Fix:** Changed `io.to(toId).emit("signal", socket.io, message)` to
  `io.to(toId).emit("signal", socket.id, message)`.

**[FIX-BACKEND] Chat-message `reduce` missing return (socketManager.js L53–59)**
- **Root cause (confirmed):** The `reduce` callback returned `undefined` for non-matching
  room iterations, causing destructuring of `undefined` and a silent runtime crash whenever
  a `chat-message` event fired from a socket not in any room.
- **Fix:** Replaced `reduce` with a plain `for...of` loop that breaks on first match.

**[FIX-D] Issue D — TypeError: Cannot read properties of null (reading 'slice')**
- **Root cause (confirmed):** `videoItem.socketId.slice(0, 5)` at VideoMeet.jsx L950 crashed
  when `socketId` was null/undefined, caused by the corrupt `fromId` from the signal relay bug.
- **Primary fix:** Signal relay fixed (see above).
- **Secondary guard:** `videoItem.socketId?.slice(0, 5) ?? "?????"` added as a belt-and-
  suspenders render defence.
- **Regression test:** `src/pages/__tests__/VideoMeet.participantTile.test.jsx` — 6 cases.

**[FIX-A] Issue A — Local Preview Blank**
- **Root cause (confirmed):** `getPermissions()` made three sequential `getUserMedia` calls
  that competed for the device lock. The `srcObject` assignment ran before the `<video>` DOM
  element was mounted (it conditionally renders only when `videoAvailable === true`).
- **Fix:** Single combined `getUserMedia` call. `srcObject` assignment moved to a `useEffect`
  that fires after DOM paint. Preview `<video>` element is always rendered; display toggled
  via CSS.

**[FIX-B] Issue B — Camera Cannot Be Re-enabled**
- **Root cause (confirmed):** `track.stop()` was called on camera toggle, releasing the
  hardware. Re-enabling called `getUserMedia` again while the browser had not released the
  device; the deprecated `addStream()` then silently failed to deliver the new track to peers.
- **Fix:** Camera toggle now uses `videoTrack.enabled = false/true` (no hardware release).
  If a track has ended (hardware disconnected), a new track is acquired and delivered via
  `replaceTrack()` on each `RTCRtpSender`. No full renegotiation triggered.
- **Mic toggle:** Same pattern — `audioTrack.enabled` only.

**[FIX-C] Issue C — New Participant Disrupts Existing Streams**
- **Root cause (confirmed):** `user-joined` handler overwrote live `RTCPeerConnection` objects
  with `connections[socketListId] = new RTCPeerConnection()` without closing them first. Also,
  all code used deprecated `addStream()` / `onaddstream` APIs.
- **Fix:**
  - All peer connection creation funnelled through `createPeerConnection()` — idempotent,
    returns the existing live connection if one already exists.
  - `addStream()` / `onaddstream` replaced with `addTrack()` / `ontrack` throughout.
  - `user-joined` handler skips PC creation if an alive connection already exists.

**[FIX-E] `connections` moved from module-level `var` to `useRef`**
- Module-level `var connections = {}` persisted across React component unmounts, causing
  ghost peer connections in Strict Mode and on Fast Refresh.
- Fix: `connectionsRef = useRef({})` inside the component. Cleanup on unmount is hermetic.

**[FIX-F] `user-left` peer connection cleanup**
- On peer departure, `connections[id].close()` is now called and the entry deleted.
  Previously the `RTCPeerConnection` object was leaked.

**[FIX-G] `secure: false` removed from Socket.IO connect**
- `io.connect(server_url, { secure: false })` explicitly disabled TLS. Removed.
  Socket.IO now auto-detects the protocol from the server URL.

**[FIX-H] Socket reconnection — idempotent room-state reconciliation**
- Added `reconnect` / `disconnect` / `reconnect_attempt` / `reconnect_failed` handlers.
- On reconnect, re-emits `join-call`. `createPeerConnection()` being idempotent means
  existing live connections are reused — no duplicate PCs are created.
- Reconnecting state shown in the in-call header banner.

**[FIX-I] Screen sharing — camera restoration via `replaceTrack()`**
- When screen sharing ends (user-initiated or browser-initiated), the camera track is
  restored via `replaceTrack()` instead of `addStream()`. Pre-sharing camera track is
  saved and reused; re-acquired from `getUserMedia` only if it has ended.

#### Backend Improvements

- Added structured JSON logging to `socketManager.js` for: `socket_connected`,
  `room_join`, `signal_relay` (type only — SDP body never logged), `chat_message`,
  `room_closed`, `socket_disconnected`.
- No credentials, SDP body, or ICE credential values are logged.

#### Testing

- **New:** `src/pages/__tests__/VideoMeet.participantTile.test.jsx` — 6 regression tests
  for the `socketId.slice()` TypeError (Issue D). All pass.
- **New:** `src/pages/__tests__/VideoMeet.mediaLifecycle.test.js` — 15 unit tests for
  `isConnectionAlive()`, camera/mic toggle via `track.enabled`, `replaceTrack()` path,
  and peer connection cleanup on user-left. All pass.
- **Total:** 21 automated tests, 21 passing.

#### Documentation

- `docs/livekit-migration-plan.md` — Staged SFU migration plan (required milestone for
  25-participant room support).
- `docs/turn-configuration.md` — TURN server setup, time-limited credential generation,
  self-hosted coturn vs managed providers.
- `docs/qa-manual-matrix.md` — 17 manual test cases covering all reported issues plus
  regression, network failure, device events, and 25-participant validation.

#### Architecture Notes

- The mesh topology is stabilised for small rooms (2–8 participants). It is **not**
  suitable for 25-participant rooms. See `docs/livekit-migration-plan.md`.
- No TURN server is configured. Connections behind symmetric NAT will fail.
  See `docs/turn-configuration.md`.

---

## [2.0.0] - 2026-10-14

### Complete Frontend Redesign: "Where Voices Converge"

#### 1. Brand Identity & Design System
- Standardized brand palette: Warm Charcoal base (`#14120F`, `#221E19`), Ember/Coral accent (`#FF7A59`, `#D9502F`), Warm Ivory text (`#F3EEE6`, `#A9A092`), Status Mint (`#5FD39A`), Amber Warning (`#F5C451`).
- Integrated Google Typography:
  - Display: `Bricolage Grotesque`
  - Body / UI: `Instrument Sans`
  - Monospace / Numerics: `JetBrains Mono` with `tabular-nums`
- Created `frontend/src/styles/palette.css` housing standard semantic CSS tokens for colors, typography, surfaces, borders, radii, shadows, and animations.
- Bridged legacy CSS variables in `frontend/src/index.css` to ensure zero broken styles.
- Updated `index.html` with official Sangam Connect branding, vector favicon, and open-graph metadata.

#### 2. Vengeance UI Component Suite (`src/components/ui/`)
Implemented zero-dependency, native CSS Module adaptations of high-end Vengeance UI patterns:
- `RadialGlowButton`: Mouse-tracking interactive glow button with accent hover dynamics.
- `GlowBorderCard`: Dynamic conic-gradient border card with subtle backdrop filter.
- `BorderBeam`: Traveling border ray highlight for active cards and preview monitors.
- `FlipText`: Kinetic 3D split-flap character animation for hero typography.
- `SpotlightNavbar`: Frosted glass navbar with mouse-following radial spotlight and responsive mobile drawer.
- `StatsCounter`: Tabular-num eased counter for live platform metrics.

#### 3. Landing Page Redesign (`src/pages/landing.jsx`)
- Complete redesign adhering to authentic platform identity.
- Replaced placeholder elements with interactive SpotlightNavbar, kinetic FlipText hero, and dual primary/secondary CTAs.
- Added a conferencing window preview framed with glowing ember beam and active participant feeds.
- Showcased WebRTC peer-to-peer audio/video architecture, Socket.IO signaling, and end-to-end token security.
- Standardized responsive footer with product navigation, brand identity, and status indicator.

#### 4. Authentication Redesign (`src/pages/authentication.jsx`)
- Premium split desktop card with atmospheric radial backdrop.
- Unified 3-mode workflow: Sign In, Register, and OTP Email Verification.
- Added interactive password reveal toggles, accessible focus states, and devOtp helper badge.
- Fully wired into `AuthContext` with backwards/forwards compatible user state.

#### 5. Dashboard Redesign (`src/pages/home.jsx`)
- Personalized greeting with user initials badge and live session duration counter.
- Two distinct meeting entry workflows:
  - "Create Instant Meeting" with auto-generated slug (`sangam-xxxxxx`).
  - "Join with Code" with format hint and input sanitization.
- Live hardware preview tile with traveling border beam, interactive camera/microphone mute toggles, and status indicator.
- Recent meetings activity grid with one-click rejoin, formatted timestamps, and per-item removal.

#### 6. Meeting History View (`src/pages/history.jsx`)
- Dedicated meeting history dashboard matching global design tokens.
- Monospace room code badges with quick copy-to-clipboard button and direct rejoin action.
- "Clear All History" modal dialog with confirmation safeguard.

#### 7. In-Call Video Conference Experience (`src/pages/VideoMeet.jsx`)
- Pre-call lobby screen featuring camera/mic pre-check, display name validation, and room badge.
- Floating in-call top header with:
  - Monospace room code display and instant invite copy button.
  - Active participant counter (`1 + n`).
  - Live duration timer with `tabular-nums`.
- Responsive WebRTC conference grid supporting dynamic participant additions/removals.
- Elegant solo waiting state when awaiting other participants.
- Docked local user picture-in-picture (PIP) tile.
- Centered glassmorphic floating control bar (Mic, Camera, Screen Share, Chat, End Call).
- Slide-out chat drawer with auto-scroll to latest messages, sender indicators, and unread notification counter.

#### 8. Verification & Performance
- Production bundle compiled with zero ESLint errors and zero build warnings (`Compiled successfully`).
- Gzip JavaScript bundle size optimized to 153.46 kB.
- Preserved all WebRTC peer connection pipelines, Socket.IO signaling contracts, and AuthContext API interfaces.

## [2.1.0] - 2026-10-14

### Reference Image Authentic Re-creation: Sangam Connect Registration Page

#### 1. Visual Layout & Brand Assets
- Re-architected full-viewport atmospheric canvas matching reference design specifications (`media_1791977749053.png`):
  - Top header with official Sangam Connect logo and `EN ⌵` language selector pill.
  - Left showcase area with `• VIDEO • VOICE • COMMUNITY` glowing eyebrow pill, "Where Voices Converge" dual-tone headline (warm cream `#F3EEE6` & coral-orange `#FF5E36`), product summary, and three feature rows (Crystal clear meetings, Communities & Channels, Secure and private).
  - Center 3D video conference visual depicting floating participant tiles (Priya R., Aniket S., Rohan K., Neha P.), active speaking glow, camera/chat/reaction floating indicators, and curved luminous orbital trails.
  - Bottom avatar stack with participant portraits and monospace tagline (`PEOPLE • IDEAS • CONVERSATIONS / ALL IN ONE PLACE`).
- Free-standing right registration panel with deep charcoal translucent backdrop (`rgba(24, 21, 18, 0.82)`), blur filter (28px), and ambient warm coral-orange glow (`0 0 60px -10px rgba(255, 94, 54, 0.25)`).

#### 2. Form Architecture & Interactions
- Segmented two-option tab control (`Sign In` | `Create Account`) highlighting active state with coral-orange border and ambient glow.
- Complete 4-field registration sequence in exact reference order:
  - Full Name (leading user outline icon, placeholder `Aniket Sharma`)
  - Email Address (leading mail outline icon, placeholder `you@college.edu`)
  - Password (leading lock outline icon, trailing password visibility toggle)
  - Confirm Password (leading lock outline icon, trailing password visibility toggle)
- Custom square coral checkbox for Terms of Service and Privacy Policy agreement.
- Gradient primary submit button with trailing right arrow (`→`), active/focus/hover/disabled/loading states.
- Clean footer with direct switch link to Sign In (`Already have an account? Sign In`).

#### 3. Verification & API Compatibility
- Maintained existing backend authentication contracts (`/register`, `/login`, `/verify-email`, `/resend-verification`).
- Preserved email verification OTP flow with auto-advancing 6-digit inputs, paste handler, and devOtp banner.
- Verified build: `npm run build` compiled successfully with 0 errors and 0 ESLint warnings.
- Verified test suite: `react-scripts test --watchAll=false --passWithNoTests` exited code 0.

## [2.2.0] - 2026-10-14

### Premium Marketing Website Redesign: Interactive 3D Connection Sculpture

#### 1. Real 3D Connection Sculpture (`src/components/SangamSculpture3D.jsx`)
- Implemented real-time GPU raymarched WebGL 3D connection sculpture depicting intertwined ribbon loops (symbolizing people, voice, video, and conversations converging).
- Material rendering with specular highlights, warm copper and glowing coral palette (`#FF6F48`, `#EA4828`), and Fresnel rim glow.
- Pointer-responsive movement: tracks mouse X/Y coordinates with smooth damping to rotate and tilt the sculpture dynamically.
- Performance: `IntersectionObserver` halts render loop when out of viewport; respects `prefers-reduced-motion`; zero external package bloat.
- Polished fallback image for unsupported hardware.

#### 2. Hero Section Composition (`src/pages/landing.jsx`, `src/styles/landing.module.css`)
- Re-architected two-column hero matching reference design (`media_1791978519873.jpg`):
  - Eyebrow: `• VIDEO · VOICE · COMMUNITY`
  - Headline: "Where voices find their people." with dual-tone warm cream and vibrant coral-orange accent.
  - Subtitle: "Clear, low-latency video calls, meaningful conversations and community spaces — all in one place."
  - Action row: "Start connecting →" primary button and "Explore the platform ›" anchor.
  - Integrated compact meeting code input form (`Enter meeting code` + `Join`).
  - Social proof participant avatar stack with tagline (`PEOPLE · IDEAS · CONVERSATIONS / ALL IN ONE PLACE`).
- Hero floating 3D overlays:
  - Live status indicator: `• Connected - 24 ms`
  - Audio waveform visualizer capsule with pulsating bars
  - Floating participant card 1: Priya R. with microphone indicator
  - Floating participant card 2: Aniket S. with microphone indicator
  - Floating community reaction badge: avatar + "Great discussion today! 👏"

#### 3. Interactive Meeting Preview
- Desktop-style meeting window framed with subtle warm border and realistic drop-shadow:
  - Top header: Sangam icon, active room badge (`🔒 sangam-community-call`), live timer (`04:28`), and participant counter (`4`).
  - Left navigation strip (Video, Chat, People, Settings).
  - 2x2 video grid featuring Aniket S. (Speaking), Priya R., Rohan K., and Meera K.
  - Floating bottom in-call controls: interactive microphone toggle (mute/unmute), camera toggle, screen share, and leave call.
  - Right tabbed drawer: interactive switching between `Chat` and `Participants (4)`.
  - Functional preview chat input allowing users to type and send messages live in the preview.

#### 4. Product Capabilities
- Editorial section: "The conversation stays in flow." with supporting description.
- 3-column capability grid:
  1. Peer-to-Peer Video (WebRTC optimized video)
  2. Community Spaces (Channels and group conversations)
  3. Meeting History (Dashboard past room tracking)

#### 5. Architecture & Interactive Diagram
- Editorial technology showcase: "Fast by design. Calm by nature."
- 3 feature highlights: Optimized peer-to-peer connections, Adaptive to real-world networks, Engineered for stability.
- Custom interactive WebRTC architecture diagram:
  - Top node: Signaling Server (`Socket.IO`) with animated dashed curve links.
  - Peer A (You) and Peer B with video status.
  - Bidirectional direct peer WebRTC connection path.
  - Adaptive relay fallback indication.
  - Interactive inspector displaying technical breakdown for each selected node.

#### 6. Value Pillars & Refined Footer
- 3 horizontal pillar cards: People First, Private by Design, Built for What's Next.
- Multi-column footer with live Product, Platform, Company navigation, legal links, and social links.

#### 7. Verification
- `npm run build`: Compiled successfully with 0 errors and 0 warnings.
- `npm test`: Exited with code 0.

## [2.3.0] - 2026-10-15

### Dashboard Redesign: Authentic Reference Re-creation (`media_1792043217477.png`)

#### 1. Visual Composition & Top Navigation
- Header bar:
  - Official Sangam Connect brand logo and tagline (`WHERE VOICES CONVERGE`).
  - Real user profile chip: avatar circle with user initials, active display name, and user handle (`@...`).
  - History navigation pill button with clock icon.
  - Sign Out button with logout icon wired to `AuthContext.handleLogout()`.
- Deep charcoal canvas (`#0C0A08`) with warm amber-coral lighting and subtle grid.

#### 2. Main Dashboard Layout (Two-Column)
- **Left Column**:
  - Spaced uppercase greeting: `GOOD TO SEE YOU AGAIN,`
  - Headline: "Welcome back, [Name]" highlighting user's name in vibrant coral-orange (`#FF5E36`).
  - Subtitle: "Where Voices Converge. Start an instant peer-to-peer video conference or join an ongoing conversation."
  - **Card 1: New Video Call**:
    - Dark graphite surface with warm border, rounded video camera icon box, title, description, and `⚡ Instant · No Setup` badge.
    - Full-width radiant coral-orange CTA button: `Create Instant Meeting →` (generates `sangam-xxxxxx`, stores to history, navigates).
  - **Card 2: Join with Code or Link**:
    - Dark graphite surface with link icon, title, and description.
    - Input row with leading `#` hash icon, clean placeholder, Enter-key handler, and `Join Call →` action button.

#### 3. 3D Centerpiece & Media Preview Monitor (Right Column)
- **3D Sculpture**:
  - Embedded `<SangamSculpture3D />` featuring real-time WebGL raymarched interlocking ribbon loops in warm copper and coral materials.
  - Sits gracefully on an elliptical dark pedestal base with copper rim reflection.
  - 3 floating pill badges stacked on the right:
    1. `Real Conversations / Real People` (people icon)
    2. `Low Latency / High Quality` (waveform icon)
    3. `Secure & Private` (shield icon)
- **Foreground Media Preview Monitor Card**:
  - Dark floating monitor card with fine warm border and ambient glow.
  - Top header: `● Media Devices Ready` (green live dot) and `📶 24 ms` latency badge.
  - Center: Live camera video feed when camera is toggled on, or large coral avatar with user initials, name, and handle.
  - Bottom controls: interactive Microphone toggle, Camera toggle (with real `getUserMedia` stream lifecycle and cleanup on unmount), and Device Settings gear button.

#### 4. Recent Meetings Section
- Section header with clock icon, description, and `View Full History →` link.
- Empty state: clean icon box, "No past meeting history yet. Create your first instant meeting above and start connecting!"
- Populated state: responsive cards with monospace meeting codes, formatted dates, one-click `Re-join Call` button, and item removal.

#### 5. Verification
- `npm run build`: Compiled successfully with 0 errors and 0 warnings.
- `npm test`: Exited code 0.
