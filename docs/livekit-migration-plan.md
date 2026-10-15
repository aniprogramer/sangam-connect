# LiveKit SFU Migration Plan — Sangam Connect

> **Status:** Required milestone. The current full-mesh WebRTC topology is stabilised for
> small rooms (2–8 participants) by the reliability fixes shipped in this revision.
> It is **not suitable** for 25-participant rooms. This document defines the mandatory
> migration path.

---

## Why SFU is required for 25-participant rooms

| Topology | Uplink per participant at 25 people | Feasibility |
|---|---|---|
| Full mesh | ~24 × 500 kbps ≈ **12 Mbps** | Impossible on consumer connections |
| SFU (LiveKit) | ~500 kbps send, selective receive | Viable |

At 25 participants a mesh participant must upload 24 streams simultaneously. A typical home
connection upstream cap is 5–20 Mbps, shared with other traffic. The mesh is not viable
beyond ~4–6 concurrent senders at 720p.

---

## Why LiveKit

Evaluated against: mediasoup, Janus, ion-sfu.

| Criterion | LiveKit | mediasoup | Janus |
|---|---|---|---|
| React SDK | ✅ `@livekit/components-react` | ❌ Manual integration | ❌ Manual integration |
| Simulcast | ✅ Built-in | ✅ Manual config | ✅ Manual config |
| Managed cloud option | ✅ livekit.io | ❌ | ❌ |
| Self-hosted Docker | ✅ Single container | ⚠ Complexity | ⚠ Complexity |
| Time-limited JWT auth | ✅ Native | ❌ Custom | ❌ Custom |
| E2EE | ✅ Built-in | ⚠ Manual | ❌ |
| Operational complexity | Low | High | High |
| Developer experience | Excellent | Low-level | Low-level |
| Active maintenance | ✅ | ✅ | ⚠ Slower cadence |

**Decision: LiveKit.**

---

## Migration Stages

### Stage 1 — Infrastructure (Prerequisite, not a code change)

Before writing any LiveKit code:

1. Choose hosting:
   - **Option A — LiveKit Cloud** (livekit.io): Easiest. Free tier covers dev/testing.
     Requires API Key + Secret from livekit.io dashboard.
   - **Option B — Self-hosted**: Single Docker container.
     ```bash
     docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
       -e LIVEKIT_KEYS="devkey: devsecret" \
       livekit/livekit-server --dev
     ```

2. Add environment variables (never commit secrets):
   ```
   # backend/.env
   LIVEKIT_API_KEY=<your-key>
   LIVEKIT_API_SECRET=<your-secret>
   LIVEKIT_URL=wss://your-project.livekit.cloud   # or ws://localhost:7880 for self-hosted
   ```

3. **Do not expose the API secret to the frontend.** The backend mints short-lived room
   tokens. The frontend receives only a token.

**Blocker:** This stage cannot proceed without credentials. All subsequent stages depend on it.

---

### Stage 2 — Backend: Room Token Endpoint

Add a new route that mints a LiveKit room access token. Existing Socket.IO room/auth
endpoints are preserved untouched.

**New file:** `backend/src/routes/livekit.routes.js`
**New dependency:** `livekit-server-sdk`

```bash
cd backend && npm install livekit-server-sdk
```

Token endpoint (pseudocode — implement after Stage 1 credentials are available):

```js
import { AccessToken } from 'livekit-server-sdk';

// POST /api/v1/livekit/token
// Body: { roomName: string, participantName: string }
// Auth: Bearer token (existing auth middleware)
export const getLiveKitToken = async (req, res) => {
  const { roomName, participantName } = req.body;

  // Validate: user must be authenticated or hold a valid guest invitation
  // Never trust client-provided identity without server-side verification.

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
      ttl: '2h',  // time-limited — no long-lived credentials
    }
  );
  at.addGrant({ roomJoin: true, room: roomName });

  return res.json({ token: at.toJwt(), url: process.env.LIVEKIT_URL });
};
```

**Verification:** `curl -X POST /api/v1/livekit/token` returns a JWT. Decode it at
`jwt.io` — confirm room claim, identity, and expiry.

---

### Stage 3 — Frontend: Install LiveKit React SDK

```bash
cd frontend && npm install @livekit/components-react @livekit/components-styles livekit-client
```

No functional change yet. Verify `npm run build` still compiles.

---

### Stage 4 — Vertical Slice (Parallel Implementation)

Create a **new** meeting page component at `frontend/src/pages/VideoMeetLK.jsx`.

Do **not** modify `VideoMeet.jsx`. Both pages coexist. Route decision is feature-flagged
(env var or URL path prefix).

The new component:
1. Fetches a LiveKit token from the backend (`/api/v1/livekit/token`).
2. Uses `<LiveKitRoom>` from `@livekit/components-react`.
3. Uses `<VideoConference>` or a custom tile layout using LiveKit hooks.
4. Preserves the existing lobby (username entry, preview) before connecting.
5. Same auth context — `userData` from `AuthContext`.

Skeleton:
```jsx
import { LiveKitRoom, VideoConference, useToken } from '@livekit/components-react';
import '@livekit/components-styles';

export default function VideoMeetLK() {
  const { url } = useParams();
  const { userData } = useContext(AuthContext);
  const [lkToken, setLkToken] = useState(null);
  const [lkUrl, setLkUrl] = useState(null);

  const fetchToken = async () => {
    const res = await axios.post('/api/v1/livekit/token', {
      roomName: url,
      participantName: userData?.name ?? username,
    }, { headers: getAuthHeader() });
    setLkToken(res.data.token);
    setLkUrl(res.data.url);
  };

  if (!lkToken) {
    return <LobbyScreen onJoin={fetchToken} />;
  }

  return (
    <LiveKitRoom
      token={lkToken}
      serverUrl={lkUrl}
      connect={true}
      video={cameraEnabled}
      audio={micEnabled}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
```

**Verification checklist before proceeding to Stage 5:**
- [ ] Two participants join same room, see and hear each other.
- [ ] Camera toggle works via LiveKit controls.
- [ ] Screen sharing works.
- [ ] Third participant joins without disrupting existing video.
- [ ] Participant leaves — tile disappears, no crash.
- [ ] Authentication: unauthenticated user cannot fetch a token.
- [ ] Token expiry: room disconnects gracefully after TTL.

---

### Stage 5 — Route Migration and Feature Flag

Add a feature flag in `frontend/src/.env`:
```
REACT_APP_USE_LIVEKIT=true
```

In `App.js`, route `/:url` to `VideoMeetLK` when the flag is set, or keep `VideoMeet`
when false. This gives a safe rollback path without a code deploy.

```js
const MeetComponent = process.env.REACT_APP_USE_LIVEKIT === 'true'
  ? VideoMeetLK
  : VideoMeetComponent;

<Route path="/:url" element={<MeetComponent />} />
```

---

### Stage 6 — Remove Legacy Mesh Code

Only after all Stage 4 verification items are checked:

1. Remove `VideoMeet.jsx` (the mesh implementation).
2. Remove `REACT_APP_USE_LIVEKIT` flag — `VideoMeetLK` becomes the only route.
3. Remove the frontend Socket.IO `join-call` / `user-joined` / `user-left` /
   `signal` event handling. **Keep** the backend `socketManager.js` only for chat
   until a LiveKit data-channel based chat is implemented.
4. Update CHANGELOG.

---

## TURN Configuration (Required for Production)

LiveKit Cloud handles TURN automatically. For self-hosted LiveKit:

```yaml
# livekit.yaml
rtc:
  turn_config:
    credential: <time-limited-credential>
    credential_ttl: 86400
    udp_port: 3478
    tls_port: 5349
```

For the current mesh fallback (before migration), add TURN to `ICE_SERVERS` in
`VideoMeet.jsx`. **Never expose long-lived TURN credentials in frontend code.**
Use short-lived credentials generated server-side (HMAC-based, per RFC 5766).

---

## 25-Participant Room Validation

Do not claim 25-participant support without:

1. A running LiveKit instance (cloud or self-hosted).
2. A load test with 25 simultaneous participants using Playwright or a bot script.
3. Measured: join success rate, time-to-first-video, packet loss, CPU on SFU host.
4. Verified: a single participant joining does not disrupt any other participant.
5. Verified: a participant leaving does not cause crashes or black video for others.

Staged load testing plan:
- Test 2 → 4 → 8 → 16 → 25 participants sequentially.
- Record RTT, jitter, packet loss, and video resolution at each stage.
- Do not skip intermediate stages.

---

## Rollback Plan

At any stage, set `REACT_APP_USE_LIVEKIT=false` (or remove the env var) to revert to
the stabilised mesh implementation. No backend rollback is required for Stages 1–4 since
the token endpoint is additive. For Stage 6+, keep a Git tag on the last known-good
mesh commit.
