import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    publicCallId: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    verificationCodeHash: { type: String, default: null },
    verificationExpiresAt: { type: Date, default: null },
    verificationAttempts: { type: Number, default: 0 },
    lastResendAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };