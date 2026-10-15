# Manual QA Matrix — Sangam Connect WebRTC

These tests cannot be fully automated because they require real browser media APIs,
physical network conditions, or multiple physical devices. Run this matrix after
every significant change to the media or signaling path.

Mark each cell: ✅ Pass | ❌ Fail | ⏭ Not tested | 🔲 Blocked (reason)

---

## Environment Record

| Field | Value |
|---|---|
| Date | |
| Tester | |
| Frontend build | `npm run build` output hash |
| Backend version | git commit SHA |
| Browser A | Chrome vX.X |
| Browser B | Firefox vX.X |
| Network | Home / Office / VPN / Mobile |
| TURN configured | Yes / No |

---

## QA Test Cases

### QA-01 — Local Preview Before Joining

**Steps:**
1. Navigate to a meeting URL.
2. Grant camera and microphone permissions when prompted.
3. Observe the lobby preview box before entering a name.

**Expected:** Camera feed visible in the preview box. No blank/black frame.  
**Actual:**  
**Notes:**

---

### QA-02 — Camera Toggle in Lobby

**Steps:**
1. On the lobby screen with a live preview, click the camera-off button.
2. Verify the preview goes to the avatar/initials placeholder.
3. Click camera-on.
4. Verify the camera feed returns.

**Expected:** Toggle is instantaneous. Camera hardware is NOT released (no permission prompt on re-enable).  
**Actual:**  
**Notes:**

---

### QA-03 — Join Meeting (Authenticated User)

**Steps:**
1. Log in as a verified user.
2. Navigate to `/test-room-001`.
3. Enter a display name and click "Join Meeting Now".

**Expected:** Meeting view loads. Local PIP tile shows own video. Waiting message shown.  
**Actual:**  
**Notes:**

---

### QA-04 — Two Participants (Chrome to Chrome)

**Steps:**
1. Open meeting URL in Tab A (Chrome). Join as "Alice".
2. Open same URL in Tab B (Chrome, or different Chrome profile). Join as "Bob".
3. Verify Alice sees Bob's video. Verify Bob sees Alice's video.
4. Speak — verify audio is audible.

**Expected:** Both participants see and hear each other within ~3 seconds of Tab B joining.  
**Actual:**  
**Notes:**

---

### QA-05 — Two Participants (Chrome to Firefox)

Same as QA-04 but Tab B uses Firefox.

**Expected:** Cross-browser video and audio work. No black tiles.  
**Actual:**  
**Notes:**

---

### QA-06 — Camera Disable and Re-enable During Call

**Steps:**
1. Two participants are in a call (QA-04 complete).
2. Alice clicks camera-off. Verify Bob sees Alice's video freeze / go dark.
3. Wait 5 seconds.
4. Alice clicks camera-on. Verify Bob sees Alice's live camera resume.
5. Repeat steps 2–4 three times.

**Expected:** Re-enable works every time without a page refresh. No console errors.  
**Actual:**  
**Notes:**

---

### QA-07 — Microphone Mute / Unmute During Call

**Steps:**
1. Two participants in a call.
2. Alice clicks mute. Speak — Bob should not hear Alice.
3. Alice clicks unmute. Speak — Bob should hear Alice.
4. Repeat 5 times.

**Expected:** Mute/unmute is reliable. No getUserMedia calls (check DevTools Network tab — no new permission prompts).  
**Actual:**  
**Notes:**

---

### QA-08 — Third Participant Joins Without Disrupting Existing Session

**Steps:**
1. Alice and Bob are already in a call with stable video (QA-04 passed).
2. Open meeting URL in a third browser profile. Join as "Charlie".
3. Observe Alice's and Bob's video tiles during and after Charlie's join.

**Expected:** Alice and Bob's video does NOT freeze, go black, or restart when Charlie joins.  
Charlie sees Alice and Bob. Alice and Bob see Charlie.  
**Actual:**  
**Notes:**

---

### QA-09 — Participant Leaves

**Steps:**
1. Alice, Bob, Charlie are in a call.
2. Charlie closes their browser tab / clicks "Leave Call".
3. Observe Alice and Bob.

**Expected:** Charlie's tile disappears from Alice's and Bob's view. No crash. No console errors about closed RTCPeerConnection.  
**Actual:**  
**Notes:**

---

### QA-10 — Screen Sharing Start and Stop

**Steps:**
1. Two participants in a call.
2. Alice clicks the screen-share button. Select a window/screen.
3. Verify Bob sees Alice's screen share.
4. Alice clicks "Stop sharing" (or browser native stop).
5. Verify Bob sees Alice's camera resume (not a blank tile).

**Expected:** Camera is restored via replaceTrack — no new offer/answer unless the SFU requires it.  
**Actual:**  
**Notes:**

---

### QA-11 — Desktop to Mobile Browser

**Steps:**
1. Alice joins from Chrome desktop.
2. Bob joins from Chrome mobile (Android) or Safari mobile (iOS).

**Expected:** Both can see and hear each other.  
**Actual:**  
**Notes:**

---

### QA-12 — Network Interruption and Reconnection

**Steps:**
1. Two participants in a stable call.
2. Alice's network is briefly disconnected (disable WiFi for 5 seconds, then re-enable).
3. Observe: "Reconnecting…" banner appears.
4. After network is restored, observe the call.

**Expected:** Call reconnects automatically. No duplicate peer connections (check DevTools → Application → Connections if available). No room-wide disruption for Bob.  
**Actual:**  
**Notes:**

---

### QA-13 — Camera Unplugged and Reconnected

**Steps:**
1. Alice joins with a USB external webcam.
2. During the call, unplug the webcam.
3. Observe Alice's local preview and Bob's view of Alice.
4. Reconnect the webcam and re-enable camera via the camera button.

**Expected:** No crash. Graceful degradation (black frame or avatar). Camera re-enable after replug works.  
**Actual:**  
**Notes:**

---

### QA-14 — Repeated Join / Leave Cycles

**Steps:**
1. Join a room, wait 10 seconds, click Leave.
2. Re-navigate to the same room URL, rejoin.
3. Repeat 5 times.

**Expected:** Each join works correctly. No ghost connections from previous sessions. No "Failed to set remote description" errors in console.  
**Actual:**  
**Notes:**

---

### QA-15 — Signaling Reconnection (Socket.IO)

**Steps:**
1. Two participants in a call.
2. Stop and restart the backend server.
3. Observe both clients' reconnection banners.
4. Wait for reconnection (default Socket.IO retry ~30 seconds).

**Expected:** Both clients reconnect and the "Reconnecting…" banner clears. Peers may need to re-join manually if the server loses room state. No crash.  
**Actual:**  
**Notes:**

---

### QA-16 — TURN Relay Scenario

**Steps:**
1. Add `iceTransportPolicy: 'relay'` temporarily to `ICE_SERVERS` in `VideoMeet.jsx`.
2. Join from two devices on different networks (not same LAN).
3. Verify connection establishes via relay.
4. Remove `relay` policy after test.

**Blocked until:** TURN server is configured.  
**Expected:** Connection succeeds via TURN relay.  
**Actual:**  
**Notes:**

---

### QA-17 — 25-Participant Room (Future — Requires LiveKit)

**Blocked until:** LiveKit migration (Stages 1–4 of `livekit-migration-plan.md`) is complete.

**Steps:**
1. Use Playwright or a bot script to join 25 participants to one LiveKit room.
2. Record: join success rate, time-to-first-video per participant, packet loss, SFU CPU.
3. Verify no participant's join disrupts others.
4. Verify all 25 participants can see/hear (at minimum, the active speaker).

---

## Known Limitations (Current Mesh)

- Maximum practical room size: **4–6 participants** at 720p on typical consumer uplinks.
- No simulcast — all participants receive the same video quality.
- No active-speaker detection — all streams always delivered.
- No adaptive bitrate — degrades under constrained bandwidth without any feedback.

These are architectural limitations of the mesh topology. They are resolved by the
LiveKit migration, not by further patching of the mesh code.
