import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createLiveKitToken } from "../services/livekit.service.js";
import { connectToSocket } from "../controllers/socketManager.js";

test("LiveKit Service - creates valid HS256 JWT with correct claims", () => {
  const token = createLiveKitToken({
    apiKey: "test-api-key",
    apiSecret: "test-api-secret-12345",
    identity: "user-alpha",
    name: "Alpha User",
    roomName: "room-gamma",
    ttlSeconds: 3600,
  });

  assert.ok(typeof token === "string", "Token must be a string");
  const parts = token.split(".");
  assert.equal(parts.length, 3, "JWT must contain header, payload, and signature");

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  assert.equal(payload.iss, "test-api-key");
  assert.equal(payload.sub, "user-alpha");
  assert.equal(payload.name, "Alpha User");
  assert.equal(payload.video.room, "room-gamma");
  assert.equal(payload.video.roomJoin, true);
  assert.equal(payload.video.canPublish, true);
  assert.equal(payload.video.canSubscribe, true);
  assert.ok(payload.exp > payload.nbf, "exp must be after nbf");
});

test("SocketManager - verifies signal relay uses socket.id instead of socket.io", () => {
  const httpServer = createServer();
  const io = connectToSocket(httpServer);

  let signalHandler = null;
  let emitted = [];

  const mockSocket = {
    id: "socket-sender-123",
    on(event, handler) {
      if (event === "signal") signalHandler = handler;
    },
  };

  const connectionListeners = io.listeners("connection");
  connectionListeners[0](mockSocket);

  const originalTo = io.to.bind(io);
  io.to = (recipientId) => ({
    emit: (eventName, fromId, payload) => {
      emitted.push({ recipientId, eventName, fromId, payload });
    },
  });

  try {
    signalHandler("socket-receiver-456", JSON.stringify({ sdp: { type: "offer" } }));
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].eventName, "signal");
    assert.equal(emitted[0].recipientId, "socket-receiver-456");
    assert.equal(emitted[0].fromId, "socket-sender-123");
    assert.equal(typeof emitted[0].fromId, "string");
  } finally {
    io.to = originalTo;
  }
});

test("SocketManager - handles join-call deduplication and media-state relay", () => {
  const httpServer = createServer();
  const io = connectToSocket(httpServer);

  let joinHandler1 = null;
  let mediaHandler1 = null;
  let leaveHandler1 = null;
  let socket1Emitted = [];

  const socket1 = {
    id: "socket-user-1",
    emit(event, ...args) {
      socket1Emitted.push({ event, args });
    },
    on(event, handler) {
      if (event === "join-call") joinHandler1 = handler;
      if (event === "media-state") mediaHandler1 = handler;
      if (event === "leave-call") leaveHandler1 = handler;
    },
  };

  let joinHandler2 = null;
  const socket2 = {
    id: "socket-user-2",
    emit() {},
    on(event, handler) {
      if (event === "join-call") joinHandler2 = handler;
    },
  };

  const connectionListeners = io.listeners("connection");
  connectionListeners[0](socket1);
  connectionListeners[0](socket2);

  let broadcastEvents = [];
  const originalTo = io.to.bind(io);
  io.to = (targetId) => ({
    emit: (eventName, ...args) => {
      broadcastEvents.push({ targetId, eventName, args });
    },
  });

  try {
    // Socket 1 joins room
    joinHandler1("room-test-101", { username: "Alice", userId: "user-123" });
    // Re-join same room (same socket ID should be deduplicated)
    joinHandler1("room-test-101", { username: "Alice", userId: "user-123" });

    // Socket 2 joins same room
    joinHandler2("room-test-101", { username: "Bob", userId: "user-456" });

    // Alice changes media state (turns camera off)
    mediaHandler1({ camera: false, mic: true });

    const mediaStateEvents = broadcastEvents.filter(
      (e) => e.eventName === "media-state-changed"
    );
    assert.ok(mediaStateEvents.length >= 1, "Must broadcast media-state-changed to peers");
    assert.equal(mediaStateEvents[0].targetId, "socket-user-2");
    assert.equal(mediaStateEvents[0].args[0], "socket-user-1");
    assert.equal(mediaStateEvents[0].args[1].camera, false);

    // Alice explicitly leaves
    leaveHandler1();
    const leaveEvents = broadcastEvents.filter((e) => e.eventName === "user-left");
    assert.ok(leaveEvents.length >= 1, "Must broadcast user-left on leave-call");
    assert.equal(leaveEvents[0].args[0], "socket-user-1");
  } finally {
    io.to = originalTo;
  }
});

test("SocketManager - supports same user in multiple tabs concurrently (Issue 4)", () => {
  const httpServer = createServer();
  const io = connectToSocket(httpServer);

  let joinTab1 = null;
  let leaveTab1 = null;
  const socketTab1 = {
    id: "socket-tab-1",
    emit() {},
    on(event, handler) {
      if (event === "join-call") joinTab1 = handler;
      if (event === "leave-call") leaveTab1 = handler;
    },
  };

  let joinTab2 = null;
  const socketTab2 = {
    id: "socket-tab-2",
    emit() {},
    on(event, handler) {
      if (event === "join-call") joinTab2 = handler;
    },
  };

  const connectionListeners = io.listeners("connection");
  connectionListeners[0](socketTab1);
  connectionListeners[0](socketTab2);

  let broadcastEvents = [];
  const originalTo = io.to.bind(io);
  io.to = (targetId) => ({
    emit: (eventName, ...args) => {
      broadcastEvents.push({ targetId, eventName, args });
    },
  });

  try {
    const commonUserId = "user-alice-primary";
    const room = "room-multi-session";

    // Alice joins from Tab 1
    joinTab1(room, { username: "Alice (Tab 1)", userId: commonUserId });

    // Alice joins from Tab 2 with the same account
    joinTab2(room, { username: "Alice (Tab 2)", userId: commonUserId });

    // Verify Tab 2 joining does NOT kick out Tab 1
    const userLeftForTab1 = broadcastEvents.filter(
      (e) => e.eventName === "user-left" && e.args[0] === "socket-tab-1"
    );
    assert.equal(
      userLeftForTab1.length,
      0,
      "Tab 1 must NOT be evicted when same user joins from Tab 2"
    );

    // Tab 1 closes
    leaveTab1();

    // Verify only Tab 1 leaves
    const userLeftEvents = broadcastEvents.filter((e) => e.eventName === "user-left");
    assert.ok(userLeftEvents.length >= 1);
    assert.equal(userLeftEvents[userLeftEvents.length - 1].args[0], "socket-tab-1");
  } finally {
    io.to = originalTo;
  }
});

test("SocketManager - Room Expiration & Inactivity Grace Period Policy (Phase Six)", async () => {
  const httpServer = createServer();
  const io = connectToSocket(httpServer);

  let join1, leave1;
  let socket1Emitted = [];
  const s1 = {
    id: "socket-exp-1",
    emit(event, payload) {
      socket1Emitted.push({ event, payload });
    },
    on(event, handler) {
      if (event === "join-call") join1 = handler;
      if (event === "leave-call") leave1 = handler;
    },
  };

  let join2;
  let socket2Emitted = [];
  const s2 = {
    id: "socket-exp-2",
    emit(event, payload) {
      socket2Emitted.push({ event, payload });
    },
    on(event, handler) {
      if (event === "join-call") join2 = handler;
    },
  };

  const listeners = io.listeners("connection");
  listeners[0](s1);
  listeners[0](s2);

  const room = "room-grace-period-test";

  // Step 1: User 1 joins room
  join1(room, { username: "User 1" });

  // Step 2: User 1 leaves room (room now empty)
  leave1();

  // Step 3: Rejoin before expiration (within grace period) -> should succeed
  join2(room, { username: "User 2" });
  assert.equal(
    socket2Emitted.filter((e) => e.event === "room-error").length,
    0,
    "Rejoin during grace period must succeed without room-error"
  );

  // Step 4: Import and test expiration rejection
  const { expireRoomImmediately } = await import("../controllers/socketManager.js");
  // User 2 leaves
  const s2Leave = { id: "socket-exp-2" };
  // Manually expire room to simulate 15-min timeout
  expireRoomImmediately(room);

  // Step 5: New user attempts to join expired room
  let join3;
  let socket3Emitted = [];
  const s3 = {
    id: "socket-exp-3",
    emit(event, payload) {
      socket3Emitted.push({ event, payload });
    },
    on(event, handler) {
      if (event === "join-call") join3 = handler;
    },
  };
  listeners[0](s3);
  join3(room, { username: "User 3" });

  const roomError = socket3Emitted.find((e) => e.event === "room-error");
  assert.ok(roomError, "Expired room must emit room-error to joining client");
  assert.equal(roomError.payload.code, "ROOM_EXPIRED");
});
