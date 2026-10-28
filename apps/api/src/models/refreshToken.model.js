import mongoose, { Schema } from "mongoose";

const refreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index: MongoDB automatically deletes documents when expiresAt is reached
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
});

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
