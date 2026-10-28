import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  senderId: {
    type: String,
    required: true,
    trim: true,
  },
  senderName: {
    type: String,
    required: true,
    trim: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

export const Message = mongoose.model("Message", messageSchema);
