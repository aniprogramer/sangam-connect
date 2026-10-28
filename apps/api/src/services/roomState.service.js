import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient = null;
let isRedisAvailable = false;

// Fallback in-memory state store
const memoryStore = {
  rooms: new Map(), // roomId -> Set of socketIds
  participants: new Map(), // socketId -> participant data
};

// Attempt Redis connection only if not explicitly in test without Redis
if (process.env.NODE_ENV !== "test" || process.env.USE_REDIS_IN_TEST) {
  try {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't spam reconnection in dev without docker
    });

    redisClient
      .connect()
      .then(() => {
        isRedisAvailable = true;
      })
      .catch(() => {
        isRedisAvailable = false;
      });
  } catch (_) {
    isRedisAvailable = false;
  }
}

export const getRedisClient = () => redisClient;
export const isRedisConnected = () => isRedisAvailable;

export const roomState = {
  async addParticipant(roomId, socketId, metadata) {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.sadd(`room:${roomId}:members`, socketId);
        await redisClient.set(
          `participant:${socketId}`,
          JSON.stringify(metadata)
        );
        return;
      } catch (_) {}
    }

    if (!memoryStore.rooms.has(roomId)) {
      memoryStore.rooms.set(roomId, new Set());
    }
    memoryStore.rooms.get(roomId).add(socketId);
    memoryStore.participants.set(socketId, metadata);
  },

  async removeParticipant(socketId) {
    let foundRoomId = null;

    if (isRedisAvailable && redisClient) {
      try {
        const metaStr = await redisClient.get(`participant:${socketId}`);
        if (metaStr) {
          const meta = JSON.parse(metaStr);
          foundRoomId = meta.room;
          await redisClient.srem(`room:${foundRoomId}:members`, socketId);
          await redisClient.del(`participant:${socketId}`);
          const count = await redisClient.scard(`room:${foundRoomId}:members`);
          return { roomId: foundRoomId, remainingCount: count };
        }
      } catch (_) {}
    }

    // Fallback in-memory
    for (const [roomId, members] of memoryStore.rooms.entries()) {
      if (members.has(socketId)) {
        foundRoomId = roomId;
        members.delete(socketId);
        memoryStore.participants.delete(socketId);
        return { roomId, remainingCount: members.size };
      }
    }

    return { roomId: foundRoomId, remainingCount: 0 };
  },

  async getParticipants(roomId) {
    if (isRedisAvailable && redisClient) {
      try {
        const socketIds = await redisClient.smembers(`room:${roomId}:members`);
        const list = [];
        for (const sid of socketIds) {
          const raw = await redisClient.get(`participant:${sid}`);
          if (raw) list.push(JSON.parse(raw));
        }
        return list;
      } catch (_) {}
    }

    const members = memoryStore.rooms.get(roomId);
    if (!members) return [];
    return Array.from(members).map((sid) => memoryStore.participants.get(sid)).filter(Boolean);
  },
};

export const getMemoryRoom = (roomId) => {
  if (!memoryStore.roomMeta) memoryStore.roomMeta = new Map();
  return memoryStore.roomMeta.get(roomId) || null;
};

export const setMemoryRoom = (roomId, meta) => {
  if (!memoryStore.roomMeta) memoryStore.roomMeta = new Map();
  memoryStore.roomMeta.set(roomId, meta);
  return meta;
};

