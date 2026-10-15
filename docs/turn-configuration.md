# TURN Server Configuration Guide — Sangam Connect

## Why TURN is Required

STUN resolves public IP addresses but cannot relay media. Behind symmetric NAT
(common in corporate networks, mobile carriers, and some home routers), STUN alone
fails. TURN relays media through the server when direct peer paths are unavailable.

Without TURN, an estimated 10–20% of real-world connections will silently fail.

## Current State

`VideoMeet.jsx` and the `ICE_SERVERS` constant include two STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

No TURN is configured. This must be resolved before any production deployment.

---

## Option A — Self-hosted coturn

Install coturn on a VPS or cloud VM with a public IP:

```bash
# Ubuntu/Debian
apt-get install coturn

# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=<REPLACE-WITH-RANDOM-SECRET-32-BYTES>
realm=turn.yourdomain.com
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
log-file=/var/log/turnserver/turnserver.log
no-stdout-log
```

Firewall: open UDP 3478, TCP 5349, and relay port range (e.g., 49152–65535 UDP).

## Option B — Managed TURN (recommended for production)

Providers with pay-per-use relay billing:
- **Twilio Network Traversal Service** — well-maintained, time-limited credentials API
- **Metered TURN** (metered.ca) — free tier available
- **Cloudflare Calls** — includes TURN relay

## Generating Time-Limited Credentials (RFC 5766)

**Never send long-lived TURN credentials to the frontend.**

Backend generates short-lived credentials on-demand (add to your API):

```js
import crypto from 'crypto';

// Returns TURN credentials valid for `ttlSeconds` (default 1 hour)
export function generateTurnCredentials(ttlSeconds = 3600) {
  const secret = process.env.TURN_STATIC_SECRET; // never expose
  const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  const credential = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');
  return { username, credential };
}
```

Frontend fetches credentials before joining and includes them in `ICE_SERVERS`.
Credentials expire after TTL — the relay cannot be abused with stolen credentials.

## Adding TURN to VideoMeet.jsx

Replace the TURN placeholder in `ICE_SERVERS`:

```js
// Fetch from your backend before joining
const { username, credential } = await fetchTurnCredentials();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:turn.yourdomain.com:3478',
        'turns:turn.yourdomain.com:5349',
      ],
      username,
      credential,
    },
  ],
};
```

## Development vs Production Configuration

| Environment | Configuration |
|---|---|
| Local development | STUN only is acceptable (same network) |
| Staging | TURN required — test with a real remote device on a different network |
| Production | TURN required — validate relay with `iceTransportPolicy: "relay"` |

## Verifying TURN Works

Force relay-only mode temporarily to confirm TURN is functional:

```js
const ICE_SERVERS = {
  iceServers: [{ urls: 'turn:...', username, credential }],
  iceTransportPolicy: 'relay',  // force relay — remove after testing
};
```

If the connection succeeds in `relay` policy, TURN is working. Remove the policy
after verification — `all` (the default) allows direct connections when available.

## LiveKit (After Migration)

LiveKit Cloud handles TURN internally — no manual TURN configuration is required.
For self-hosted LiveKit, use the `turn_config` block in `livekit.yaml` (see
`livekit-migration-plan.md`).
