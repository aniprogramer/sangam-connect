import "dotenv/config";
import express from "express";
import { createServer } from "node:http";

// import { Server } from "socket.io";

import mongoose, { mongo } from "mongoose";

import cors from "cors";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";
import livekitRoutes from "./routes/livekit.routes.js";

const port = process.env.PORT || 8002;
const dbUrl =
  process.env.DATABASE_URL ||
  "mongodb+srv://<username>:<password>@cluster0.mongodb.net/sangam";
const app = express();
app.set("port", port);
const server = createServer(app);
const io = connectToSocket(server);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3045",
  "http://localhost:5173",
  "https://antarsetubackend.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/health", (req, res) => res.status(200).json({ status: "ok", timestamp: Date.now() }));

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
