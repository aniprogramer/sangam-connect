import crypto from "node:crypto";
import express, { Router } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
  createLiveKitToken,
  verifyLiveKitWebhook,
  resolveRole,
  roomService,
} from "../services/livekit.service.js";
import { Room } from "../models/room.model.js";
import { getMemoryRoom, setMemoryRoom } from "../services/roomState.service.js";
import { validate, livekitTokenSchema } from "../validators/index.js";

const router = Router();
const ROOM_GRACE_PERIOD_MS =
  parseInt(process.env.ROOM_GRACE_PERIOD_MS, 10) || 15 * 60 * 1000;

const randomSuffix = (length) =>
  crypto.randomBytes(8).toString("hex").slice(0, length);

/** userId from a valid Bearer access token, or null for guests. */
const userIdFromRequest = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") || !process.env.JWT_SECRET) return null;
  try {
    return jwt.verify(header.substring(7), process.env.JWT_SECRET).sub || null;
  } catch (_) {
    return null;
  }
};

/** Live participant count from LiveKit, falling back to the webhook-stored count. */
const countParticipants = async (roomName, room) => {
  try {
    const list = await roomService().listParticipants(roomName);
    return list.length;
  } catch (_) {
    return room?.participantCount || 0;
  }
};

router.post("/token", validate(livekitTokenSchema), async (req, res) => {
  try {
    // Client-sent identity and roomAdmin are ignored: identity and role are server-side only.
    const { roomName, name, avatar } = req.body;

    if (!roomName) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "roomName is required.",
      });
    }

    const userId = userIdFromRequest(req);
    // Random suffix per join so a second tab does not replace the first session.
    const identity = userId ? `u-${userId}-${randomSuffix(6)}` : `g-${randomSuffix(8)}`;
    const roleKey = userId || identity;

    const rawRoomName = roomName;
    const effectiveRoomName = rawRoomName.startsWith("@")
      ? `user-${rawRoomName.slice(1).toLowerCase()}`
      : rawRoomName;

    // Check room expiration state in database
    let room = null;
    if (mongoose.connection?.readyState === 1 || process.env.NODE_ENV === "test") {
      try {
        room = await Room.findOne({ roomId: effectiveRoomName });
      } catch (err) {
        // fallback
      }
    }
    if (!room) {
      room = getMemoryRoom(effectiveRoomName);
    }


    if (room) {
      if (room.status === "expired") {
        return res.status(httpStatus.FORBIDDEN).json({
          code: "ROOM_EXPIRED",
          message: "This meeting room has expired.",
        });
      }

      if (room.status === "empty") {
        const now = Date.now();
        const leftAt = room.lastParticipantLeftAt
          ? new Date(room.lastParticipantLeftAt).getTime()
          : 0;

        if (leftAt && now - leftAt > ROOM_GRACE_PERIOD_MS) {
          room.status = "expired";
          if (room.save) await room.save();
          return res.status(httpStatus.FORBIDDEN).json({
            code: "ROOM_EXPIRED",
            message: "This meeting room has expired due to inactivity.",
          });
        }

        // Room rejoined within grace period: reactivate
        room.status = "active";
        room.lastParticipantLeftAt = null;
        if (room.save) await room.save();
      }
    } else {
      // First participant creates the room and becomes host.
      if (mongoose.connection?.readyState === 1) {
        try {
          room = await Room.create({
            roomId: effectiveRoomName,
            creatorId: roleKey,
            status: "active",
          });
        } catch (err) {
          room = await Room.findOne({ roomId: effectiveRoomName }).catch(() => null);
        }
      }
      if (!room) {
        room = setMemoryRoom(effectiveRoomName, {
          roomId: effectiveRoomName,
          creatorId: roleKey,
          status: "active",
          roles: {},
          participantCount: 0,
        });
      }
    }

    // Rooms first created by another endpoint have no creator yet: first token caller claims host.
    if (!room.creatorId) {
      room.creatorId = roleKey;
      if (room.save) await room.save();
    }

    const participantCount = await countParticipants(effectiveRoomName, room);
    const role = resolveRole(room, roleKey, participantCount);
    const isHost = role === "host" || role === "cohost";

    const maxParticipants = parseInt(process.env.MAX_PARTICIPANTS, 10) || 500;
    if (participantCount >= maxParticipants && role !== "host") {
      return res.status(httpStatus.FORBIDDEN).json({
        code: "ROOM_FULL",
        message: `This meeting is full (${maxParticipants} participants).`,
      });
    }

    if (room && room.isLocked && !isHost) {
      return res.status(httpStatus.FORBIDDEN).json({
        code: "ROOM_LOCKED",
        message: "This meeting room is locked by the host.",
      });
    }

    const isWaiting = Boolean(room && room.waitingRoomEnabled && !isHost);

    const token = createLiveKitToken({
      identity,
      name,
      roomName: effectiveRoomName,
      roomAdmin: isHost,
      role,
      metadata: {
        username: name || identity,
        avatar: avatar || null,
        isGuest: !userId,
        userId,
      },
    });

    const livekitUrl =
      process.env.LIVEKIT_URL ||
      (process.env.NODE_ENV === "production"
        ? "wss://sangam.livekit.cloud"
        : "ws://localhost:7880");

    return res.status(httpStatus.OK).json({
      token,
      url: livekitUrl,
      identity,
      role,
      isHost,
      isWaiting,
      waitingRoomEnabled: Boolean(room?.waitingRoomEnabled),
      isLocked: Boolean(room?.isLocked),
      isRecording: Boolean(room?.isRecording),
    });
  } catch (error) {
    console.error("LiveKit token generation error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to generate LiveKit token.",
    });
  }
});

// LiveKit posts Content-Type application/webhook+json, which express.json() skips.
// Keep the raw body so the sha256 claim is checked against the exact bytes sent.
router.post("/webhook", express.raw({ type: "application/webhook+json" }), async (req, res) => {
  const authHeader = req.headers.authorization;
  const rawBody = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
  const isVerified = verifyLiveKitWebhook(rawBody, authHeader);

  if (!isVerified && process.env.NODE_ENV === "production") {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid webhook signature" });
  }

  try {
    const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
    const numParticipants = event?.room?.numParticipants || 0;
    const roomName = event?.room?.name;

    if (roomName) {
      if (event.event === "room_finished") {
        await Room.findOneAndUpdate(
          { roomId: roomName },
          { status: "expired", lastParticipantLeftAt: new Date() }
        );
      } else if (event.event === "participant_left") {
        await Room.findOneAndUpdate(
          { roomId: roomName },
          numParticipants === 0
            ? { status: "empty", lastParticipantLeftAt: new Date(), participantCount: 0 }
            : { participantCount: numParticipants }
        );
      } else if (
        event.event === "participant_joined" ||
        event.event === "room_started"
      ) {
        await Room.findOneAndUpdate(
          { roomId: roomName },
          { status: "active", lastParticipantLeftAt: null, participantCount: numParticipants }
        );
      }
    }

    return res.status(httpStatus.OK).json({ received: true });
  } catch (err) {
    console.error("LiveKit webhook processing error:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Webhook processing error" });
  }
});

export default router;
