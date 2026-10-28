import crypto from "node:crypto";
import { Router } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { Room } from "../models/room.model.js";
import { getMemoryRoom, setMemoryRoom } from "../services/roomState.service.js";
import {
  validate,
  moderationSchema,
  recordingSchema,
  breakoutSchema,
  chatUploadSchema,
} from "../validators/index.js";

const router = Router();

const getOrCreateRoom = async (roomId, callerIdentity = null) => {
  if (mongoose.connection?.readyState === 1) {
    try {
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = await Room.create({
          roomId,
          creatorId: callerIdentity || null,
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
      creatorId: callerIdentity || null,
      status: "active",
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
router.post("/:roomId/moderation", validate(moderationSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { action, targetIdentity, callerIdentity } = req.body;
    const room = await getOrCreateRoom(roomId, callerIdentity);

    if (["mute-individual", "remove-participant", "transfer-host"].includes(action) && !targetIdentity) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: `targetIdentity is required for action '${action}'`,
      });
    }

    if (room) {
      if (action === "lock-room") room.isLocked = true;
      if (action === "unlock-room") room.isLocked = false;
      if (action === "toggle-waiting-room") room.waitingRoomEnabled = !room.waitingRoomEnabled;
      if (action === "transfer-host") room.creatorId = targetIdentity;
      if (room.save) await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("room-moderation", {
        action,
        targetIdentity: targetIdentity || null,
        callerIdentity: callerIdentity || null,
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

// ── POST /:roomId/recording/start ───────────────────────────────────────────
router.post("/:roomId/recording/start", validate(recordingSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { callerIdentity } = req.body;
    const room = await getOrCreateRoom(roomId, callerIdentity);

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
router.post("/:roomId/recording/stop", validate(recordingSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getOrCreateRoom(roomId);
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
router.post("/:roomId/breakout/create", validate(breakoutSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { rooms, callerIdentity } = req.body;
    const room = await getOrCreateRoom(roomId, callerIdentity);

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
router.post("/:roomId/breakout/close", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getOrCreateRoom(roomId);

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

