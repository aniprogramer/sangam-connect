import mongoose, { Schema } from "mongoose";

const roomSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    creatorId: {
      type: String,
      default: null,
      trim: true,
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
