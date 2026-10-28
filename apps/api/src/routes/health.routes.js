import { Router } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import Redis from "ioredis";
import config from "../config/index.js";

const router = Router();

/**
 * Liveness probe - Lightweight check confirming the process is alive.
 */
router.get("/health", (req, res) => {
  return res.status(httpStatus.OK).json({ status: "ok", ts: Date.now() });
});

/**
 * Readiness probe - Deep check confirming external dependencies (MongoDB, Redis, LiveKit).
 */
router.get("/ready", async (req, res) => {
  const checks = {
    mongodb: false,
    redis: "skipped",
    livekit: "skipped",
  };

  let allReady = true;

  // MongoDB check
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      checks.mongodb = true;
    } else {
      allReady = false;
    }
  } catch (_) {
    allReady = false;
  }

  // Redis check (if configured)
  if (config.REDIS_URL) {
    try {
      const redis = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      checks.redis = true;
    } catch (_) {
      checks.redis = false;
      allReady = false;
    }
  }

  // LiveKit server check (if configured)
  if (config.LIVEKIT_URL) {
    try {
      const httpUrl = config.LIVEKIT_URL.replace(/^wss?:\/\//, "http://");
      const resp = await fetch(httpUrl, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      checks.livekit = resp.status < 500;
    } catch (_) {
      checks.livekit = false;
      if (config.NODE_ENV === "production") {
        allReady = false;
      }
    }
  }

  if (!allReady) {
    return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      status: "unavailable",
      checks,
    });
  }

  return res.status(httpStatus.OK).json({
    status: "ready",
    ts: Date.now(),
    checks,
  });
});

export default router;
