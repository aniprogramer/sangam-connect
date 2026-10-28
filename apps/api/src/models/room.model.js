import mongoose, { Schema } from "mongoose";
import { ROLES } from "../services/livekit.service.js";

const roomSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    // Role key of the host: userId for signed-in users, LiveKit identity for guests.
    creatorId: {
      type: String,
      default: null,
      trim: true,
    },
    // Role key -> role, set by host/cohost promote/demote.
    roles: {
      type: Map,
      of: { type: String, enum: ROLES },
      default: {},
    },
    // Last count reported by LiveKit webhooks; fallback when the SFU API is unreachable.
    participantCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "empty", "expired"],
      default: "active",
      index: true,
    },
    lastParticipantLeftAt: {
      type: Date,
      default: null,
    },
    waitingRoomEnabled: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    isRecording: {
      type: Boolean,
      default: false,
    },
    recordingId: {
      type: String,
      default: null,
    },
    breakoutRooms: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        participants: [{ type: String }],
      },
    ],
    e2eeEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Room = mongoose.model("Room", roomSchema);
