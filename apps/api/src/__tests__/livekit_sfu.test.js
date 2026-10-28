import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import {
  createLiveKitToken,
  verifyLiveKitWebhook,
} from "../services/livekit.service.js";
import livekitRouter from "../routes/livekit.routes.js";
import roomRouter from "../routes/room.routes.js";
import { Message } from "../models/message.model.js";
import { Room } from "../models/room.model.js";

test("LiveKit Service - default token claims include canPublishData: true", () => {
  const token = createLiveKitToken({
    identity: "user-123",
    name: "User 123",
    roomName: "room-abc",
  });

  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  assert.equal(payload.sub, "user-123");
  assert.equal(payload.name, "User 123");
  assert.equal(payload.video.room, "room-abc");
  assert.equal(payload.video.roomJoin, true);
  assert.equal(payload.video.canPublish, true);
  assert.equal(payload.video.canSubscribe, true);
  assert.equal(payload.video.canPublishData, true);
  assert.equal(payload.video.roomAdmin, undefined);
});

test("LiveKit Service - roomAdmin: true adds admin grant", () => {
  const token = createLiveKitToken({
    identity: "admin-456",
    name: "Admin",
    roomName: "room-abc",
    roomAdmin: true,
  });

  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  assert.equal(payload.video.roomAdmin, true);
});

test("LiveKit Service - metadata is properly serialized as JSON string", () => {
  const metaObj = { role: "host", avatar: "avatar1.png" };
  const token = createLiveKitToken({
    identity: "user-789",
    roomName: "room-abc",
    metadata: metaObj,
  });

  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  assert.equal(typeof payload.metadata, "string");
  assert.deepEqual(JSON.parse(payload.metadata), metaObj);
});

test("LiveKit Service - webhook signature verification", () => {
  const secret = "testsecret123456789012345678901234567890";
  const body = JSON.stringify({ event: "participant_joined", id: "p1" });

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const sha256Body = crypto.createHash("sha256").update(body).digest("base64url");
  const payload = Buffer.from(JSON.stringify({ sha256: sha256Body })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const validToken = `${header}.${payload}.${signature}`;

  assert.equal(verifyLiveKitWebhook(body, validToken, secret), true);
  assert.equal(verifyLiveKitWebhook(body, `Bearer ${validToken}`, secret), true);

  // Tampered payload
  assert.equal(verifyLiveKitWebhook(body + "tampered", validToken, secret), false);
  // Invalid secret
  assert.equal(verifyLiveKitWebhook(body, validToken, "wrongsecret"), false);
  // Missing header
  assert.equal(verifyLiveKitWebhook(body, "", secret), false);
});

process.env.NODE_ENV = "test";

test("LiveKit Route - enforces room expiration with 403 ROOM_EXPIRED", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/livekit", livekitRouter);

  // Mock Room.findOne to simulate expired room
  const originalFindOne = Room.findOne;
  Room.findOne = async () => ({
    roomId: "expired-room",
    status: "expired",
  });

  try {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const res = await fetch(`http://127.0.0.1:${port}/api/v1/livekit/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: "expired-room",
        identity: "user-test",
      }),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, "ROOM_EXPIRED");

    server.close();
  } finally {
    Room.findOne = originalFindOne;
  }
});

test("Room Route - GET /:roomId/messages returns paginated history", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/rooms", roomRouter);

  const originalFind = Message.find;
  const mockMessages = [
    { roomId: "test-room", senderId: "s1", senderName: "User 1", text: "Hello", createdAt: new Date("2026-01-01T10:00:00Z") },
    { roomId: "test-room", senderId: "s2", senderName: "User 2", text: "World", createdAt: new Date("2026-01-01T10:01:00Z") },
  ];

  Message.find = () => ({
    sort: () => ({
      limit: async (lim) => mockMessages.slice(0, lim),
    }),
  });

  try {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const res = await fetch(`http://127.0.0.1:${port}/api/v1/rooms/test-room/messages?limit=2`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 2);
    // reversed for chronological order
    assert.equal(data[0].text, "World");
    assert.equal(data[1].text, "Hello");

    server.close();
  } finally {
    Message.find = originalFind;
  }
});
