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
import mongoose from "mongoose";
import cors from "cors";

import { corsOptions } from "./config/cors.js";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";
import livekitRoutes from "./routes/livekit.routes.js";

// Validate mandatory database environment variable on startup
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const port = parseInt(process.env.PORT, 10) || 8002;
const dbUrl = process.env.DATABASE_URL;

const app = express();
app.set("port", port);

// Amendment 6: Trust reverse proxy hops (nginx/Caddy/Cloudflare) in production for accurate IP rate-limiting
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const server = createServer(app);
const io = connectToSocket(server);

// Strict CORS protection
app.use(cors(corsOptions));

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/health", (req, res) =>
  res.status(200).json({ status: "ok", timestamp: Date.now() })
);

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/livekit", livekitRoutes);

const start = async () => {
  app.set("mongo_user");
  const connectionDb = await mongoose.connect(dbUrl);
  console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`);
  server.listen(app.get("port"), "0.0.0.0", () => {
    console.log(`LISTENING ON PORT ${port}`);
  });
};

start();
