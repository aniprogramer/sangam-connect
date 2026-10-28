import { Router } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { createLiveKitToken, verifyLiveKitWebhook } from "../services/livekit.service.js";
import { Room } from "../models/room.model.js";
import { getMemoryRoom } from "../services/roomState.service.js";
import { validate, livekitTokenSchema } from "../validators/index.js";

const router = Router();
const ROOM_GRACE_PERIOD_MS =
  parseInt(process.env.ROOM_GRACE_PERIOD_MS, 10) || 15 * 60 * 1000;

router.post("/token", validate(livekitTokenSchema), async (req, res) => {
  try {
    const { roomName, identity, name, isGuest, avatar, roomAdmin } = req.body;

    if (!roomName || !identity) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "roomName and identity are required.",
      });
    }

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
    } else if (mongoose.connection?.readyState === 1) {
      // First participant creates the room
      try {
        room = await Room.create({
          roomId: effectiveRoomName,
          creatorId: identity,
          status: "active",
        });
      } catch (err) {
        // ignore duplicate or creation error
      }
    }

    const isHost = Boolean(roomAdmin || (room && room.creatorId === identity));

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
      metadata: {
        username: name || identity,
        avatar: avatar || null,
        isGuest: Boolean(isGuest),
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

router.post("/webhook", async (req, res) => {
  const authHeader = req.headers.authorization;
  const isVerified = verifyLiveKitWebhook(req.body, authHeader);

  if (!isVerified && process.env.NODE_ENV === "production") {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid webhook signature" });
  }

  try {
    const event = req.body;
    const roomName = event?.room?.name;

    if (roomName) {
      if (event.event === "room_finished") {
        await Room.findOneAndUpdate(
          { roomId: roomName },
          { status: "expired", lastParticipantLeftAt: new Date() }
        );
      } else if (event.event === "participant_left") {
        if (event.room?.numParticipants === 0) {
          await Room.findOneAndUpdate(
            { roomId: roomName },
            { status: "empty", lastParticipantLeftAt: new Date() }
          );
        }
      } else if (
        event.event === "participant_joined" ||
        event.event === "room_started"
      ) {
        await Room.findOneAndUpdate(
          { roomId: roomName },
          { status: "active", lastParticipantLeftAt: null }
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
