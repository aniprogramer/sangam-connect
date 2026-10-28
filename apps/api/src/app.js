// ==============================================================================
// SECURITY WARNING TO HUMAN OPERATOR:
// The previously committed MongoDB connection credentials in this file
// ([REDACTED_USER]) have been exposed to version control history.
// You MUST IMMEDIATELY rotate this password in MongoDB Atlas and configure the
// new connection string inside your private backend/.env file as DATABASE_URL.
// ==============================================================================

import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import crypto from "node:crypto";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import config from "./config/index.js";
import { corsOptions } from "./config/cors.js";
import { connectToSocket } from "./controllers/socketManager.js";
import logger from "./utils/logger.js";
import healthRoutes from "./routes/health.routes.js";
import userRoutes from "./routes/users.routes.js";
import livekitRoutes from "./routes/livekit.routes.js";
import roomRoutes from "./routes/room.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.js";

const app = express();
app.set("port", config.PORT);

// Trust reverse proxy in production for accurate rate-limiting
if (config.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const server = createServer(app);
const io = connectToSocket(server);
app.set("io", io);

// ── 1. Request ID Middleware ──────────────────────────────────────────────────
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

// ── 2. Structured Logging Middleware ──────────────────────────────────────────
if (config.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    })
  );
}

// ── 3. Security & Body Parsing ────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ limit: "100kb", extended: true }));

// ── 4. Routes ─────────────────────────────────────────────────────────────────
app.use("/", healthRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/livekit", livekitRoutes);
app.use("/api/v1/rooms", roomRoutes);

// ── 5. Error Handling ─────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── 6. Graceful Shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {});
  io.close();
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
    } catch (_) {}
  }
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── 7. Server Bootstrap ───────────────────────────────────────────────────────
export const start = async () => {
  app.set("mongo_user");
  const connectionDb = await mongoose.connect(config.DATABASE_URL);
  logger.info(`MONGO Connected DB Host: ${connectionDb.connection.host}`);
  server.listen(app.get("port"), "0.0.0.0", () => {
    logger.info(`LISTENING ON PORT ${config.PORT}`);
  });
};

const isTest =
  config.NODE_ENV === "test" ||
  process.env.npm_lifecycle_event === "test" ||
  process.argv.some((arg) => arg.includes("test"));

if (!isTest) {
  start().catch((err) => {
    logger.error(`Boot error: ${err.message}`);
    process.exit(1);
  });
}

export { app, server, io };
