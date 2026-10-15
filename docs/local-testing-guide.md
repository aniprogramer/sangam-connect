# Sangam Connect — Multi-Participant Local Testing Guide

Testing multiple participants in real-time WebRTC meetings on a single physical development machine involves operating system device constraints, browser security sandboxes, and session isolation.

---

## 1. Physical Device Contention vs. Signaling Failure

### Why Hardware Contention Occurs
Most consumer operating systems (Windows, macOS, and standard Linux V4L2 drivers) enforce an **exclusive hardware lock** on video capture devices (webcams). When Browser Window A opens `/dev/video0` or `AVCaptureDevice`, any subsequent attempt by Browser Window B to call `navigator.mediaDevices.getUserMedia({ video: true })` on that same physical sensor will reject with:

- `NotReadableError: Could not start video source`
- `TrackStartError: Concurrent camera access restricted`

This is **not a signaling or network failure**.

### How Sangam Connect Handles Hardware Contention
Sangam Connect's `acquireLocalStream()` catches `NotReadableError` and `TrackStartError`. When the webcam is locked by another window or app:
1. It automatically falls back to an audio-only stream (`audio: true, video: false`).
2. It sets `cameraEnabled = false` and `videoAvailable = false`.
3. It displays an alert badge: *"Camera is in use by another application or browser window. Continuing with microphone only."*
4. It broadcasts `media-state: { camera: false, mic: true }` so remote participants see the participant's branded avatar tile instead of a frozen or black frame.

---

## 2. Recommended Local Testing Strategies

### Strategy A: Chromium Fake Media Devices (Best for Automated & Multi-Window Tests)

Chromium includes built-in fake media streams that do not touch physical hardware, allowing unlimited concurrent instances on a single machine:

```bash
# Terminal 1 — Launch Participant Alice
google-chrome \
  --user-data-dir=/tmp/sangam-user-alice \
  --use-fake-device-for-media-stream \
  --use-fake-ui-for-media-stream \
  http://localhost:3000/sangam-test1

# Terminal 2 — Launch Participant Bob
google-chrome \
  --user-data-dir=/tmp/sangam-user-bob \
  --use-fake-device-for-media-stream \
  --use-fake-ui-for-media-stream \
  http://localhost:3000/sangam-test1
```

**Benefits:**
- Emulates a moving color-bar/pacman video feed and a gentle 440 Hz audio beep.
- Bypasses permission prompts automatically (`--use-fake-ui-for-media-stream`).
- Each instance has its own isolated cookies, `localStorage`, and session identity.

---

### Strategy B: Separate Browser Profiles (Best for Manual QA)

When you need to test realistic human interaction without fake video:

1. **Window 1 (Authenticated Member):**
   - Use your primary Chrome profile.
   - Log in with your verified user account.
   - Join `/sangam-meet-alpha` (the physical webcam attaches to Window 1).

2. **Window 2 (Guest Participant):**
   - Open a Chrome **Incognito Window** or a **Guest Profile**.
   - Navigate to `/sangam-meet-alpha`.
   - The webcam will be locked by Window 1; Sangam Connect will automatically join as an audio participant with an avatar placeholder.
   - To test video in both windows simultaneously without fake flags, attach a second USB webcam or use OBS Virtual Camera.

3. **Window 3 (Cross-Browser):**
   - Open **Firefox**.
   - Join `/sangam-meet-alpha`.
   - Tests Firefox's unified plan WebRTC negotiation with Chrome.

---

### Strategy C: Virtual Cameras (OBS Studio)

1. Launch **OBS Studio**.
2. Click **Start Virtual Camera**.
3. In Sangam Connect's **Audio & Video Settings Modal** (`Settings` button), select `"OBS Virtual Camera"` for Participant B, while Participant A uses the built-in webcam.

---

## 3. Session & Storage Isolation

| Participant Type | Storage State | Expected UI Role |
|---|---|---|
| **Member** | Valid JWT token in `localStorage.getItem("token")` | Displays `"Member"` badge in Participants Panel |
| **Guest** | No token in `localStorage` | Prompts for display name, displays `"Guest"` badge |

Always test with at least one authenticated member and one guest in the same room to verify permission boundaries and participant directory synchronization.
