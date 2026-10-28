import { test } from "node:test";
import assert from "node:assert";
import express from "express";
import roomRoutes from "../routes/room.routes.js";
import userRoutes from "../routes/users.routes.js";
import livekitRoutes from "../routes/livekit.routes.js";

const withServer = async (fn) => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/rooms", roomRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/livekit", livekitRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("Phase 6 Room Routes - GET /:roomId/state returns default state", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/rooms/test-state-room/state`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.roomId, "test-state-room");
    assert.strictEqual(body.isLocked, false);
    assert.strictEqual(body.isRecording, false);
  });
});

test("Phase 6 Room Routes - POST /:roomId/moderation applies lock and mute-all", async () => {
  await withServer(async (base) => {
    const lockRes = await fetch(`${base}/api/v1/rooms/test-mod-room/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock-room" }),
    });
    assert.strictEqual(lockRes.status, 200);
    const lockBody = await lockRes.json();
    assert.strictEqual(lockBody.room.isLocked, true);

    const muteRes = await fetch(`${base}/api/v1/rooms/test-mod-room/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mute-all" }),
    });
    assert.strictEqual(muteRes.status, 200);
    const muteBody = await muteRes.json();
    assert.strictEqual(muteBody.action, "mute-all");

    const missingTargetRes = await fetch(`${base}/api/v1/rooms/test-mod-room/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mute-individual" }),
    });
    assert.strictEqual(missingTargetRes.status, 400);
  });
});

test("Phase 6 Room Routes - Recording Start & Stop lifecycle", async () => {
  await withServer(async (base) => {
    const startRes = await fetch(`${base}/api/v1/rooms/test-rec-room/recording/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerIdentity: "host-1" }),
    });
    assert.strictEqual(startRes.status, 200);
    const startBody = await startRes.json();
    assert.strictEqual(startBody.status, "started");
    assert.ok(startBody.recordingId.startsWith("egress-"));

    const stopRes = await fetch(`${base}/api/v1/rooms/test-rec-room/recording/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerIdentity: "host-1" }),
    });
    assert.strictEqual(stopRes.status, 200);
    const stopBody = await stopRes.json();
    assert.strictEqual(stopBody.status, "stopped");
  });
});

test("Phase 6 Room Routes - Breakout Rooms Create and Close", async () => {
  await withServer(async (base) => {
    const createRes = await fetch(`${base}/api/v1/rooms/test-breakout-room/breakout/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rooms: [
          { name: "Breakout 1", participants: ["user-1", "user-2"] },
          { name: "Breakout 2", participants: ["user-3"] },
        ],
      }),
    });
    assert.strictEqual(createRes.status, 200);
    const createBody = await createRes.json();
    assert.strictEqual(createBody.breakoutRooms.length, 2);

    const closeRes = await fetch(`${base}/api/v1/rooms/test-breakout-room/breakout/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(closeRes.status, 200);
    const closeBody = await closeRes.json();
    assert.strictEqual(closeBody.success, true);
  });
});

test("Phase 6 Room Routes - Chat File Upload", async () => {
  await withServer(async (base) => {
    const uploadRes = await fetch(`${base}/api/v1/rooms/test-upload-room/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "test.png",
        fileType: "image/png",
        fileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        fileSize: 68,
      }),
    });
    assert.strictEqual(uploadRes.status, 200);
    const uploadBody = await uploadRes.json();
    assert.strictEqual(uploadBody.fileName, "test.png");
    assert.strictEqual(uploadBody.fileType, "image/png");
  });
});

test("Phase 6 User Routes - GET /@:username/room resolves personal permanent room", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/users/@aniket/room`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.username, "aniket");
    assert.strictEqual(body.roomId, "user-aniket");
    assert.strictEqual(body.roomUrl, "/meet/@aniket");
  });
});

test("Phase 6 LiveKit Route - @username token minting and room lock checks", async () => {
  await withServer(async (base) => {
    // Test @username normalization
    const tokenRes = await fetch(`${base}/api/v1/livekit/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: "@alice", identity: "guest-1", name: "Guest" }),
    });
    assert.strictEqual(tokenRes.status, 200);
    const tokenBody = await tokenRes.json();
    assert.ok(tokenBody.token);

    // Lock room via moderation
    await fetch(`${base}/api/v1/rooms/locked-test-room/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock-room" }),
    });

    // Guest join attempt to locked room without roomAdmin
    const lockedRes = await fetch(`${base}/api/v1/livekit/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: "locked-test-room", identity: "guest-2", roomAdmin: false }),
    });
    assert.strictEqual(lockedRes.status, 403);
    const lockedBody = await lockedRes.json();
    assert.strictEqual(lockedBody.code, "ROOM_LOCKED");
  });
});
