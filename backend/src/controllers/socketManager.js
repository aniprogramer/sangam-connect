import { Server } from "socket.io";

/** @type {Record<string, string[]>} room path → [socketId, ...] */
let connections = {};
/** @type {Record<string, {sender:string, data:string, socketId:string}[]>} */
let messages = {};
/** @type {Record<string, Date>} socketId → join time */
let timeOnline = {};
/** @type {Record<string, { socketId: string, room: string, username: string, userId?: string, isGuest: boolean, mediaState: { camera: boolean, mic: boolean, screenSharing: boolean, isSpeaking: boolean } }>} */
let participantMeta = {};

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
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

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
        delete connections[roomPath];
        delete messages[roomPath];
        log.info("room_closed", { room: roomPath });
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
    socket.on("join-call", (path, userMeta = {}) => {
      if (!connections[path]) {
        connections[path] = [];
      }

      // Deduplicate: avoid pushing same socket.id multiple times
      if (!connections[path].includes(socket.id)) {
        connections[path].push(socket.id);
      }

      timeOnline[socket.id] = new Date();
      participantMeta[socket.id] = {
        socketId: socket.id,
        room: path,
        username: userMeta?.username || "Participant",
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

      // Notify all participants (including joiner) of user join with meta
      for (let i = 0; i < connections[path].length; i++) {
        io.to(connections[path][i]).emit(
          "user-joined",
          socket.id,
          connections[path],
          participantMeta[socket.id]
        );
      }

      // Replay chat history to the new joiner.
      if (messages[path]) {
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

    // ── signal ────────────────────────────────────────────────────────────────
    socket.on("signal", (toId, message) => {
      log.info("signal_relay", {
        fromId: socket.id,
        toId,
        signalType: (() => {
          try {
            const parsed = JSON.parse(message);
            if (parsed.sdp) return `sdp:${parsed.sdp.type}`;
            if (parsed.ice) return "ice";
            return "unknown";
          } catch {
            return "parse_error";
          }
        })(),
      });
      io.to(toId).emit("signal", socket.id, message);
    });

    // ── chat-message ──────────────────────────────────────────────────────────
    socket.on("chat-message", (data, sender, messageId) => {
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
