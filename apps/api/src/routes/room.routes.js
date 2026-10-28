import crypto from "node:crypto";
import { Router } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { Room } from "../models/room.model.js";
import { getMemoryRoom, setMemoryRoom } from "../services/roomState.service.js";
import {
  grantsForRole,
  resolveRole,
  roleKeyOf,
  roomService,
  verifyLiveKitToken,
} from "../services/livekit.service.js";
import {
  validate,
  moderationSchema,
  recordingSchema,
  breakoutSchema,
  chatUploadSchema,
  roleChangeSchema,
} from "../validators/index.js";

const router = Router();

const getOrCreateRoom = async (roomId) => {
  if (mongoose.connection?.readyState === 1) {
    try {
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = await Room.create({
          roomId,
          creatorId: null,
          status: "active",
          waitingRoomEnabled: false,
          isLocked: false,
          isRecording: false,
          recordingId: null,
          breakoutRooms: [],
          e2eeEnabled: false,
        });
      }
      return room;
    } catch (_) {}
  }

  let mem = getMemoryRoom(roomId);
  if (!mem) {
    mem = setMemoryRoom(roomId, {
      roomId,
      creatorId: null,
      status: "active",
      roles: {},
      participantCount: 0,
      waitingRoomEnabled: false,
      isLocked: false,
      isRecording: false,
      recordingId: null,
      breakoutRooms: [],
      e2eeEnabled: false,
      save: async function () {
        setMemoryRoom(this.roomId, this);
      },
    });
  }
  return mem;
};

/**
 * Authorizes the caller with their own LiveKit token (Authorization: Bearer <token>).
 * The token proves identity for both users and guests; the role is re-read from the room,
 * so a demoted participant's older token grants nothing.
 */
const requireRoomRole = (...allowedRoles) => async (req, res, next) => {
  const header = req.headers.authorization || "";
  const payload = header.startsWith("Bearer ")
    ? verifyLiveKitToken(header.substring(7))
    : null;

  if (!payload?.sub) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      code: "NOT_AUTHORIZED",
      message: "A valid meeting token is required.",
    });
  }

  const { roomId } = req.params;
  if (payload.video?.room !== roomId) {
    return res.status(httpStatus.FORBIDDEN).json({
      code: "NOT_AUTHORIZED",
      message: "Meeting token is for a different room.",
    });
  }

  try {
    const room = await getOrCreateRoom(roomId);
    const role = resolveRole(room, roleKeyOf(payload.sub));
    if (!allowedRoles.includes(role)) {
      return res.status(httpStatus.FORBIDDEN).json({
        code: "NOT_AUTHORIZED",
        message: "Only the host or a co-host can do this.",
      });
    }
    req.room = room;
    req.caller = { identity: payload.sub, role };
    next();
  } catch (error) {
    next(error);
  }
};

const setStoredRole = (room, key, role) => {
  if (typeof room.roles?.set === "function") room.roles.set(key, role);
  else room.roles = { ...(room.roles || {}), [key]: role };
};

// ── GET /:roomId/messages ────────────────────────────────────────────────────
router.get("/:roomId/messages", async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const query = { roomId };
    if (before && !isNaN(before.getTime())) {
      query.createdAt = { $lt: before };
    }

    let messages = [];
    if (mongoose.connection?.readyState === 1 || process.env.NODE_ENV === "test") {
      messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
    }

    return res.status(httpStatus.OK).json((messages || []).reverse());
  } catch (error) {
    console.error("Fetch room messages error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to fetch room messages.",
    });
  }
});

// ── GET /:roomId/state ───────────────────────────────────────────────────────
router.get("/:roomId/state", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getOrCreateRoom(roomId);
    if (!room) {
      return res.status(httpStatus.OK).json({
        roomId,
        status: "active",
        waitingRoomEnabled: false,
        isLocked: false,
        isRecording: false,
        recordingId: null,
        creatorId: null,
        breakoutRooms: [],
        e2eeEnabled: false,
      });
    }

    return res.status(httpStatus.OK).json({
      roomId: room.roomId,
      status: room.status,
      waitingRoomEnabled: Boolean(room.waitingRoomEnabled),
      isLocked: Boolean(room.isLocked),
      isRecording: Boolean(room.isRecording),
      recordingId: room.recordingId || null,
      creatorId: room.creatorId || null,
      breakoutRooms: room.breakoutRooms || [],
      e2eeEnabled: Boolean(room.e2eeEnabled),
    });
  } catch (error) {
    console.error("Fetch room state error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to fetch room state.",
    });
  }
});

// ── POST /:roomId/moderation ─────────────────────────────────────────────────
router.post("/:roomId/moderation", validate(moderationSchema), requireRoomRole("host", "cohost"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { action, targetIdentity } = req.body;
    const { room } = req;
    const callerIdentity = req.caller.identity;

    if (action === "transfer-host" && req.caller.role !== "host") {
      return res.status(httpStatus.FORBIDDEN).json({
        code: "NOT_AUTHORIZED",
        message: "Only the host can transfer host.",
      });
    }

    if (["mute-individual", "remove-participant", "transfer-host"].includes(action) && !targetIdentity) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: `targetIdentity is required for action '${action}'`,
      });
    }

    if (room) {
      if (action === "lock-room") room.isLocked = true;
      if (action === "unlock-room") room.isLocked = false;
      if (action === "toggle-waiting-room") room.waitingRoomEnabled = !room.waitingRoomEnabled;
      if (action === "transfer-host") room.creatorId = roleKeyOf(targetIdentity);
      if (room.save) await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("room-moderation", {
        action,
        targetIdentity: targetIdentity || null,
        callerIdentity,
        waitingRoomEnabled: room?.waitingRoomEnabled,
        isLocked: room?.isLocked,
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      action,
      targetIdentity: targetIdentity || null,
      room: {
        isLocked: Boolean(room?.isLocked),
        waitingRoomEnabled: Boolean(room?.waitingRoomEnabled),
        creatorId: room?.creatorId || null,
      },
    });
  } catch (error) {
    console.error("Room moderation error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to apply room moderation.",
    });
  }
});

// ── POST /:roomId/participants/:identity/role ───────────────────────────────
// Promote/demote a participant. Persists the role by role key (userId or guest identity)
// and updates the live LiveKit permissions so the change applies without rejoining.
router.post(
  "/:roomId/participants/:identity/role",
  validate(roleChangeSchema),
  requireRoomRole("host", "cohost"),
  async (req, res) => {
    try {
      const { roomId, identity } = req.params;
      const { role } = req.body;
      const { room } = req;
      const targetKey = roleKeyOf(identity);
      const currentRole = resolveRole(room, targetKey);

      if (currentRole === "host") {
        return res.status(httpStatus.FORBIDDEN).json({
          code: "NOT_AUTHORIZED",
          message: "The host's role cannot be changed. Use transfer-host instead.",
        });
      }
      if ((role === "cohost" || currentRole === "cohost") && req.caller.role !== "host") {
        return res.status(httpStatus.FORBIDDEN).json({
          code: "NOT_AUTHORIZED",
          message: "Only the host can add or remove co-hosts.",
        });
      }

      setStoredRole(room, targetKey, role);
      if (room.save) await room.save();

      let live = true;
      try {
        const participant = await roomService().getParticipant(roomId, identity);
        let metadata = {};
        try {
          metadata = JSON.parse(participant.metadata || "{}");
        } catch (_) {}
        await roomService().updateParticipant(
          roomId,
          identity,
          JSON.stringify({ ...metadata, role }),
          grantsForRole(role)
        );
      } catch (_) {
        // Not connected (or SFU unreachable): role still applies on next join.
        live = false;
      }

      const io = req.app.get("io");
      if (io) {
        io.to(roomId).emit("room-moderation", {
          action: "role-changed",
          targetIdentity: identity,
          role,
          callerIdentity: req.caller.identity,
        });
        if (role !== "attendee") {
          io.to(roomId).emit("hand-raise", { identity, raised: false });
        }
      }

      return res.status(httpStatus.OK).json({ success: true, identity, role, live });
    } catch (error) {
      console.error("Role change error:", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Failed to change participant role.",
      });
    }
  }
);

// ── POST /:roomId/recording/start ───────────────────────────────────────────
router.post("/:roomId/recording/start", validate(recordingSchema), requireRoomRole("host", "cohost"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { room } = req;

    const recordingId = `egress-${crypto.randomUUID()}`;
    if (room) {
      room.isRecording = true;
      room.recordingId = recordingId;
      if (room.save) await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("recording-status", {
        isRecording: true,
        recordingId,
      });
    }

    return res.status(httpStatus.OK).json({
      status: "started",
      recordingId,
      egressUrl: `s3://sangam-recordings/${roomId}/${recordingId}.mp4`,
    });
  } catch (error) {
    console.error("Start recording error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to start recording.",
    });
  }
});

// ── POST /:roomId/recording/stop ────────────────────────────────────────────
router.post("/:roomId/recording/stop", validate(recordingSchema), requireRoomRole("host", "cohost"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { room } = req;
    const recordingId = room?.recordingId || "unknown";

    if (room) {
      room.isRecording = false;
      room.recordingId = null;
      if (room.save) await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("recording-status", {
        isRecording: false,
        recordingId,
      });
    }

    return res.status(httpStatus.OK).json({
      status: "stopped",
      recordingId,
    });
  } catch (error) {
    console.error("Stop recording error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to stop recording.",
    });
  }
});

// ── POST /:roomId/breakout/create ───────────────────────────────────────────
router.post("/:roomId/breakout/create", validate(breakoutSchema), requireRoomRole("host", "cohost"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { rooms } = req.body;
    const { room } = req;

    const formattedRooms = rooms.map((r, idx) => ({
      id: r.id || `${roomId}-breakout-${idx + 1}`,
      name: r.name,
      participants: r.participants || [],
    }));

    if (room) {
      room.breakoutRooms = formattedRooms;
      if (room.save) await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("breakout-broadcast", {
        action: "created",
        breakoutRooms: formattedRooms,
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      breakoutRooms: formattedRooms,
    });
  } catch (error) {
    console.error("Create breakout rooms error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to create breakout rooms.",
    });
  }
});

// ── POST /:roomId/breakout/close ────────────────────────────────────────────
router.post("/:roomId/breakout/close", requireRoomRole("host", "cohost"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { room } = req;

    if (room) {
      room.breakoutRooms = [];
      if (room.save) await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("breakout-broadcast", {
        action: "closed",
        breakoutRooms: [],
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      message: "Breakout rooms closed successfully.",
    });
  } catch (error) {
    console.error("Close breakout rooms error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to close breakout rooms.",
    });
  }
});

// ── POST /:roomId/upload ────────────────────────────────────────────────────
router.post("/:roomId/upload", validate(chatUploadSchema), async (req, res) => {
  try {
    const { fileName, fileType, fileData, fileSize } = req.body;

    return res.status(httpStatus.OK).json({
      success: true,
      fileUrl: fileData,
      fileName,
      fileType,
      fileSize: fileSize || fileData.length,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to upload file.",
    });
  }
});

export default router;

