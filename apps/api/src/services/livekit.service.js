import crypto from "node:crypto";
import { RoomServiceClient } from "livekit-server-sdk";

export const ROLES = ["host", "cohost", "speaker", "attendee"];

const LARGE_ROOM_THRESHOLD = () =>
  parseInt(process.env.LARGE_ROOM_THRESHOLD, 10) || 50;

/**
 * LiveKit participant permissions for a room role.
 * Attendees only subscribe: chat and hand-raise go through Socket.IO, not data channels.
 */
export const grantsForRole = (role) => {
  const canPublish = role !== "attendee";
  return { canPublish, canSubscribe: true, canPublishData: canPublish };
};

/**
 * Stable key used to store roles: userId for "u-<userId>-<rand>" identities,
 * the full identity for guests.
 */
export const roleKeyOf = (identity = "") => {
  const match = /^u-(.+)-[a-z0-9]+$/.exec(identity);
  return match ? match[1] : identity;
};

const storedRole = (room, key) =>
  typeof room?.roles?.get === "function" ? room.roles.get(key) : room?.roles?.[key];

/**
 * Resolves a participant's role from server-side room state only.
 * Creator is host, then any stored role, then a default based on room size.
 */
export const resolveRole = (room, roleKey, participantCount = 0) => {
  if (room?.creatorId && room.creatorId === roleKey) return "host";
  const stored = storedRole(room, roleKey);
  if (ROLES.includes(stored)) return stored;
  return participantCount >= LARGE_ROOM_THRESHOLD() ? "attendee" : "speaker";
};

let roomServiceClient = null;

/** Lazy RoomServiceClient for live permission updates. Tests replace it with setRoomService. */
export const roomService = () => {
  if (!roomServiceClient) {
    const host = (process.env.LIVEKIT_URL || "ws://localhost:7880").replace(/^ws/, "http");
    roomServiceClient = new RoomServiceClient(
      host,
      process.env.LIVEKIT_API_KEY || "devkey",
      process.env.LIVEKIT_API_SECRET || "devsecret",
      { requestTimeout: 3 }
    );
  }
  return roomServiceClient;
};

export const setRoomService = (client) => {
  roomServiceClient = client;
};

/**
 * Generates standard LiveKit-compatible Access Token JWT using node:crypto.
 * Zero external dependencies.
 *
 * @param {Object} params
 * @param {string} [params.apiKey]
 * @param {string} [params.apiSecret]
 * @param {string} params.identity
 * @param {string} [params.name]
 * @param {string} params.roomName
 * @param {boolean} [params.roomAdmin=false]
 * @param {string} [params.role] - room role; sets publish grants and is added to metadata
 * @param {string|Object} [params.metadata]
 * @param {number} [params.ttlSeconds=7200]
 * @returns {string} Signed JWT
 */
export const createLiveKitToken = ({
  apiKey = process.env.LIVEKIT_API_KEY || "devkey",
  apiSecret = process.env.LIVEKIT_API_SECRET || "devsecret",
  identity,
  name,
  roomName,
  roomAdmin = false,
  role,
  metadata,
  ttlSeconds = 7200,
}) => {
  if (!identity || !roomName) {
    throw new Error("identity and roomName are required to mint a LiveKit token");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const videoGrant = {
    room: roomName,
    roomJoin: true,
    ...grantsForRole(role),
  };

  if (roomAdmin) {
    videoGrant.roomAdmin = true;
  }

  if (role) {
    metadata = { ...(typeof metadata === "string" ? JSON.parse(metadata) : metadata), role };
  }

  let serializedMetadata = undefined;
  if (metadata) {
    serializedMetadata =
      typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  }

  const payload = {
    iss: apiKey,
    sub: identity,
    name: name || identity,
    nbf: now - 5,
    exp: now + ttlSeconds,
    video: videoGrant,
  };

  if (serializedMetadata !== undefined) {
    payload.metadata = serializedMetadata;
  }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
};

/**
 * Verifies a LiveKit JWT (HS256) signed with LIVEKIT_API_SECRET.
 *
 * @param {string} token
 * @param {string} [apiSecret]
 * @returns {Object|null} payload when signature and expiry are valid
 */
export const verifyLiveKitToken = (
  token,
  apiSecret = process.env.LIVEKIT_API_SECRET || "devsecret"
) => {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;

    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");
    const given = Buffer.from(parts[2]);
    const expected = Buffer.from(signature);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
};

/**
 * Validates LiveKit Webhook Authorization JWT against LIVEKIT_API_SECRET.
 *
 * @param {string|Buffer|Object} rawBody
 * @param {string} authHeader
 * @param {string} [apiSecret]
 * @returns {boolean}
 */
export const verifyLiveKitWebhook = (
  rawBody,
  authHeader,
  apiSecret = process.env.LIVEKIT_API_SECRET || "devsecret"
) => {
  if (!authHeader) return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  const payload = verifyLiveKitToken(token, apiSecret);
  if (!payload) return false;

  if (payload.sha256) {
    const bodyContent =
      typeof rawBody === "string" || Buffer.isBuffer(rawBody)
        ? rawBody
        : JSON.stringify(rawBody);
    const computedHash = crypto.createHash("sha256").update(bodyContent).digest("base64");
    const computedUrl = crypto.createHash("sha256").update(bodyContent).digest("base64url");
    if (payload.sha256 !== computedHash && payload.sha256 !== computedUrl) {
      return false;
    }
  }

  return true;
};
