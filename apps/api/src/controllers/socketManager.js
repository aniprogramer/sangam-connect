import { Server } from "socket.io";
import mongoose from "mongoose";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { allowedOrigins } from "../config/cors.js";
import { Message } from "../models/message.model.js";

/** @type {Record<string, string[]>} room path → [socketId, ...] */
let connections = {};
/** @type {Record<string, {sender:string, data:string, socketId:string}[]>} */
let messages = {};
/** @type {Record<string, Date>} socketId → join time */
let timeOnline = {};
/** @type {Record<string, { socketId: string, room: string, username: string, userId?: string, isGuest: boolean, mediaState: { camera: boolean, mic: boolean, screenSharing: boolean, isSpeaking: boolean } }>} */
let participantMeta = {};

export const ROOM_GRACE_PERIOD_MS =
  parseInt(process.env.ROOM_GRACE_PERIOD_MS, 10) || 15 * 60 * 1000;

/** @type {Record<string, { status: "active" | "empty" | "expired", createdAt: Date, lastParticipantLeftAt: Date | null, expirationTimer: any }>} */
let roomState = {};

// ── Structured logger ────────────────────────────────────────────────────────
// Never log raw tokens, passwords, SDP body, or ICE credentials.
const log = {
  info: (event, fields = {}) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", event, ...fields })),
  warn: (event, fields = {}) =>
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", event, ...fields })),
  error: (event, fields = {}) =>
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event, ...fields })),
};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  if (process.env.REDIS_URL) {
    try {
      const pubClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
      const subClient = pubClient.duplicate();
      pubClient.on("error", (err) => log.warn("redis_pub_error", { error: err.message }));
      subClient.on("error", (err) => log.warn("redis_sub_error", { error: err.message }));
      io.adapter(createAdapter(pubClient, subClient));
      log.info("redis_adapter_connected");
    } catch (err) {
      log.warn("redis_adapter_failed_fallback_memory", { error: err.message });
    }
  }

  const removeSocketFromRoom = (socketId) => {
    let foundRoom = null;

    for (const [roomPath, members] of Object.entries(connections)) {
      const idx = members.indexOf(socketId);
      if (idx === -1) continue;

      foundRoom = roomPath;
      members.splice(idx, 1);

      // Notify all remaining participants that this socket left.
      for (const memberId of members) {
        io.to(memberId).emit("user-left", socketId);
      }

      if (members.length === 0) {
        const leftAt = new Date();
        const existingTimer = roomState[roomPath]?.expirationTimer;
        if (existingTimer) clearTimeout(existingTimer);

        roomState[roomPath] = {
          status: "empty",
          createdAt: roomState[roomPath]?.createdAt || leftAt,
          lastParticipantLeftAt: leftAt,
          expirationTimer: setTimeout(() => {
            if (!connections[roomPath] || connections[roomPath].length === 0) {
              if (roomState[roomPath]) {
                roomState[roomPath].status = "expired";
                roomState[roomPath].expirationTimer = null;
              }
              delete connections[roomPath];
              delete messages[roomPath];
              log.info("room_expired", {
                room: roomPath,
                gracePeriodMs: ROOM_GRACE_PERIOD_MS,
                lastParticipantLeftAt: leftAt,
              });
            }
          }, ROOM_GRACE_PERIOD_MS),
        };

        log.info("room_empty_grace_period_started", {
          room: roomPath,
          gracePeriodMs: ROOM_GRACE_PERIOD_MS,
          lastParticipantLeftAt: leftAt,
        });
      }

      break;
    }

    delete participantMeta[socketId];
    delete timeOnline[socketId];
    return foundRoom;
  };

  io.on("connection", (socket) => {
    log.info("socket_connected", { socketId: socket.id });

    // ── join-call ─────────────────────────────────────────────────────────────
    socket.on("join-call", async (path, userMeta = {}) => {
      // Check if room has expired
      const currentRoom = roomState[path];
      if (currentRoom && currentRoom.status === "expired") {
        log.warn("join_rejected_room_expired", { socketId: socket.id, room: path });
        socket.emit("room-error", {
          code: "ROOM_EXPIRED",
          message: "This meeting room has expired because all participants left more than 15 minutes ago.",
        });
        return;
      }

      // Rejoining during grace period: cancel pending expiration timer
      if (currentRoom && currentRoom.status === "empty") {
        if (currentRoom.expirationTimer) {
          clearTimeout(currentRoom.expirationTimer);
          currentRoom.expirationTimer = null;
        }
        currentRoom.status = "active";
        currentRoom.lastParticipantLeftAt = null;
        log.info("room_grace_period_cancelled", { socketId: socket.id, room: path });
      } else if (!currentRoom) {
        roomState[path] = {
          status: "active",
          createdAt: new Date(),
          lastParticipantLeftAt: null,
          expirationTimer: null,
        };
      }

      if (!connections[path]) {
        connections[path] = [];
      }

      // Deduplicate: avoid pushing same socket.id multiple times
      if (!connections[path].includes(socket.id)) {
        connections[path].push(socket.id);
      }
      if (typeof socket.join === "function") {
        socket.join(path);
      }


      timeOnline[socket.id] = new Date();
      participantMeta[socket.id] = {
        socketId: socket.id,
        room: path,
        username: userMeta?.username || "Participant",
        identity: userMeta?.identity || null,
        userId: userMeta?.userId || null,
        isGuest: userMeta?.isGuest ?? !userMeta?.userId,
        mediaState: {
          camera: userMeta?.mediaState?.camera ?? true,
          mic: userMeta?.mediaState?.mic ?? true,
          screenSharing: false,
          isSpeaking: false,
        },
      };

      log.info("room_join", {
        socketId: socket.id,
        room: path,
        username: participantMeta[socket.id].username,
        participantCount: connections[path].length,
      });

      // Collect metadata for all current members in this room
      const roomParticipants = {};
      for (const memberId of connections[path]) {
        if (participantMeta[memberId]) {
          roomParticipants[memberId] = participantMeta[memberId];
        }
      }

      // Send the current participants directory directly to the new joiner
      socket.emit("room-participants", roomParticipants);

      // Notify all participants of user join with meta
      for (let i = 0; i < connections[path].length; i++) {
        io.to(connections[path][i]).emit("participant-joined", participantMeta[socket.id]);
        io.to(connections[path][i]).emit(
          "user-joined",
          socket.id,
          connections[path],
          participantMeta[socket.id]
        );
      }

      // Replay chat history to the new joiner
      let replayed = false;
      if (mongoose.connection?.readyState === 1) {
        try {
          const dbMsgs = await Message.find({ roomId: path }).sort({ createdAt: -1 }).limit(100);
          if (dbMsgs && dbMsgs.length > 0) {
            const chronological = dbMsgs.reverse();
            for (const msg of chronological) {
              io.to(socket.id).emit("chat-message", msg.text, msg.senderName, msg.senderId, msg._id.toString());
            }
            replayed = true;
          }
        } catch (err) {
          log.warn("chat_history_db_error", { error: err.message, room: path });
        }
      }

      if (!replayed && messages[path]) {
        for (const msg of messages[path]) {
          io.to(socket.id).emit(
            "chat-message",
            msg.data,
            msg.sender,
            msg.socketId,
            msg.id
          );
        }
      }
    });

    // ── leave-call (explicit client unmount / exit) ───────────────────────────
    socket.on("leave-call", () => {
      const room = removeSocketFromRoom(socket.id);
      log.info("user_explicit_leave", { socketId: socket.id, room: room ?? "none" });
    });

    // ── media-state synchronization ──────────────────────────────────────────
    socket.on("media-state", (state = {}) => {
      if (participantMeta[socket.id]) {
        participantMeta[socket.id].mediaState = {
          ...participantMeta[socket.id].mediaState,
          ...state,
        };

        const room = participantMeta[socket.id].room;
        if (room && connections[room]) {
          for (const memberId of connections[room]) {
            if (memberId !== socket.id) {
              io.to(memberId).emit("media-state-changed", socket.id, participantMeta[socket.id].mediaState);
            }
          }
        }
      }
    });

    // ── reaction ──────────────────────────────────────────────────────────────
    socket.on("reaction", (emoji) => {
      const meta = participantMeta[socket.id];
      const room = meta?.room;
      if (!room || !connections[room]) return;
      for (const recipientId of connections[room]) {
        io.to(recipientId).emit("reaction", {
          emoji,
          senderId: socket.id,
          senderName: meta?.username || "Participant",
          timestamp: Date.now(),
        });
      }
    });

    // ── waiting-room signaling ────────────────────────────────────────────────
    socket.on("waiting-room-join", ({ roomId, identity, name }) => {
      if (typeof socket.join === "function") {
        socket.join(`${roomId}-waiting`);
      }

      if (connections[roomId]) {
        for (const recipientId of connections[roomId]) {
          io.to(recipientId).emit("waiting-room-request", {
            identity,
            name: name || identity,
            socketId: socket.id,
            roomId,
          });
        }
      }
    });

    socket.on("waiting-room-decision", ({ roomId, targetSocketId, targetIdentity, approved }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit("waiting-room-response", {
          approved: Boolean(approved),
          roomId,
          targetIdentity,
        });
      }
    });

    // ── hand-raise signaling ──────────────────────────────────────────────────
    socket.on("hand-raise", ({ raised, roomId }) => {
      const meta = participantMeta[socket.id];
      const room = roomId || meta?.room;
      if (!room || !connections[room]) return;
      for (const recipientId of connections[room]) {
        io.to(recipientId).emit("hand-raise", {
          socketId: socket.id,
          identity: meta?.identity || meta?.username || socket.id,
          raised: Boolean(raised),
        });
      }
    });

    // ── live captions / transcription-chunk ───────────────────────────────────
    socket.on("transcription-chunk", ({ text, speaker, isFinal, roomId }) => {
      const meta = participantMeta[socket.id];
      const room = roomId || meta?.room;
      if (!room || !connections[room]) return;
      for (const recipientId of connections[room]) {
        io.to(recipientId).emit("transcription-chunk", {
          text,
          speaker: speaker || meta?.username || "Speaker",
          isFinal: Boolean(isFinal),
          socketId: socket.id,
          timestamp: Date.now(),
        });
      }
    });

    // room-moderation is emitted only by the REST routes after a host/cohost check;
    // clients can no longer broadcast it directly.

    // ── chat-message ──────────────────────────────────────────────────────────
    socket.on("chat-message", async (data, sender, messageId) => {
      let matchingRoom = null;
      for (const [roomKey, roomValue] of Object.entries(connections)) {
        if (roomValue.includes(socket.id)) {
          matchingRoom = roomKey;
          break;
        }
      }

      if (matchingRoom === null) {
        log.warn("chat_no_room", { socketId: socket.id });
        return;
      }

      const stableId = messageId || `${Date.now()}-${socket.id}-${Math.random().toString(36).slice(2, 7)}`;

      if (!messages[matchingRoom]) {
        messages[matchingRoom] = [];
      }
      messages[matchingRoom].push({ id: stableId, sender, data, socketId: socket.id });

      if (mongoose.connection?.readyState === 1) {
        try {
          await Message.create({
            roomId: matchingRoom,
            senderId: socket.id,
            senderName: sender || "Participant",
            text: typeof data === "string" ? data : JSON.stringify(data),
            createdAt: new Date(),
          });
        } catch (err) {
          log.warn("chat_db_save_error", { error: err.message, room: matchingRoom });
        }
      }

      log.info("chat_message", { room: matchingRoom, sender });

      for (const recipientId of connections[matchingRoom]) {
        io.to(recipientId).emit("chat-message", data, sender, socket.id, stableId);
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const room = removeSocketFromRoom(socket.id);
      log.info("socket_disconnected", {
        socketId: socket.id,
        room: room ?? "none",
      });
    });
  });

  return io;
};

export const getRoomState = (roomPath) => roomState[roomPath] || null;

export const expireRoomImmediately = (roomPath) => {
  if (roomState[roomPath]) {
    if (roomState[roomPath].expirationTimer) {
      clearTimeout(roomState[roomPath].expirationTimer);
      roomState[roomPath].expirationTimer = null;
    }
    roomState[roomPath].status = "expired";
    delete connections[roomPath];
    delete messages[roomPath];
  }
};

export const resetRoomState = () => {
  for (const r of Object.values(roomState)) {
    if (r.expirationTimer) clearTimeout(r.expirationTimer);
  }
  connections = {};
  messages = {};
  timeOnline = {};
  participantMeta = {};
  roomState = {};
};
