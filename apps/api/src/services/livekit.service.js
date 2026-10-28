import crypto from "node:crypto";

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
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  };

  if (roomAdmin) {
    videoGrant.roomAdmin = true;
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
  try {
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");

    if (signature !== parts[2]) return false;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    if (payload.sha256) {
      const bodyContent =
        typeof rawBody === "string" || Buffer.isBuffer(rawBody)
          ? rawBody
          : JSON.stringify(rawBody);
      const computedHash = crypto
        .createHash("sha256")
        .update(bodyContent)
        .digest("base64url");
      if (payload.sha256 !== computedHash) {
        return false;
      }
    }

    return true;
  } catch (_) {
    return false;
  }
};
