import crypto from "node:crypto";

/**
 * Generates standard LiveKit-compatible Access Token JWT using node:crypto.
 * Zero external dependencies.
 *
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.apiSecret
 * @param {string} params.identity
 * @param {string} [params.name]
 * @param {string} params.roomName
 * @param {number} [params.ttlSeconds=7200]
 * @returns {string} Signed JWT
 */
export const createLiveKitToken = ({
  apiKey = process.env.LIVEKIT_API_KEY || "devkey",
  apiSecret = process.env.LIVEKIT_API_SECRET || "devsecret",
  identity,
  name,
  roomName,
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

  const payload = {
    iss: apiKey,
    sub: identity,
    name: name || identity,
    nbf: now - 5,
    exp: now + ttlSeconds,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    },
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
};
