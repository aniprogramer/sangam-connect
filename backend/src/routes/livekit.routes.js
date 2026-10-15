import { Router } from "express";
import httpStatus from "http-status";
import { createLiveKitToken } from "../services/livekit.service.js";

const router = Router();

router.post("/token", async (req, res) => {
  try {
    const { roomName, identity, name } = req.body;

    if (!roomName || !identity) {
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "roomName and identity are required.",
      });
    }

    const token = createLiveKitToken({
      identity,
      name,
      roomName,
    });

    const livekitUrl =
      process.env.LIVEKIT_URL ||
      (process.env.NODE_ENV === "production"
        ? "wss://sangam.livekit.cloud"
        : "ws://localhost:7880");

    return res.status(httpStatus.OK).json({
      token,
      url: livekitUrl,
    });
  } catch (error) {
    console.error("LiveKit token generation error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to generate LiveKit token.",
    });
  }
});

export default router;
