import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import livekitRoutes from "../routes/livekit.routes.js";
import roomRoutes from "../routes/room.routes.js";
import {
  createLiveKitToken,
  grantsForRole,
  resolveRole,
  roleKeyOf,
  setRoomService,
  verifyLiveKitWebhook,
} from "../services/livekit.service.js";

process.env.JWT_SECRET = "roles-test-jwt-secret-at-least-32-characters";
process.env.LARGE_ROOM_THRESHOLD = "50";
process.env.MAX_PARTICIPANTS = "100";

const decode = (token) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));

// Stub LiveKit RoomService; tests set `participants` and read `updates`.
const sfu = { participants: 0, connected: true, updates: [] };
setRoomService({
  listParticipants: async () => Array.from({ length: sfu.participants }),
  getParticipant: async (room, identity) => {
    if (!sfu.connected) throw new Error("not found");
    return { identity, metadata: JSON.stringify({ username: "x" }) };
  },
  updateParticipant: async (room, identity, metadata, permission) => {
    sfu.updates.push({ room, identity, metadata: JSON.parse(metadata), permission });
  },
});

const withServer = async (fn) => {
  const app = express();
  app.use(express.json());
  const emitted = [];
  app.set("io", { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) });
  app.use("/api/v1/livekit", livekitRoutes);
  app.use("/api/v1/rooms", roomRoutes);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, emitted);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const join = async (base, roomName, { userId, body = {} } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (userId) {
    headers.Authorization = `Bearer ${jwt.sign({ sub: userId }, process.env.JWT_SECRET)}`;
  }
  const res = await fetch(`${base}/api/v1/livekit/token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ roomName, name: "P", ...body }),
  });
  return { status: res.status, body: await res.json() };
};

const setRole = (base, roomName, token, identity, role) =>
  fetch(`${base}/api/v1/rooms/${roomName}/participants/${identity}/role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role }),
  });

test("Roles - grantsForRole: only attendees lose publish and data", () => {
  for (const role of ["host", "cohost", "speaker"]) {
    assert.deepEqual(grantsForRole(role), {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
  }
  assert.deepEqual(grantsForRole("attendee"), {
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  });
});

test("Roles - attendee token has no publish grant and role in metadata", () => {
  const payload = decode(
    createLiveKitToken({ identity: "g-1", roomName: "r", role: "attendee", metadata: { a: 1 } })
  );
  assert.equal(payload.video.canPublish, false);
  assert.equal(payload.video.canSubscribe, true);
  assert.deepEqual(JSON.parse(payload.metadata), { a: 1, role: "attendee" });
});

test("Roles - resolveRole: creator, stored role, then threshold default", () => {
  const room = { creatorId: "u1", roles: new Map([["u2", "cohost"]]) };
  assert.equal(resolveRole(room, "u1", 500), "host");
  assert.equal(resolveRole(room, "u2", 500), "cohost");
  assert.equal(resolveRole(room, "u3", 49), "speaker");
  assert.equal(resolveRole(room, "u3", 50), "attendee");
  assert.equal(resolveRole({ roles: { g: "speaker" } }, "g", 500), "speaker");
});

test("Roles - roleKeyOf maps user identities to userId, guests to themselves", () => {
  assert.equal(roleKeyOf("u-64f0c0ffee-a1b2c3"), "64f0c0ffee");
  assert.equal(roleKeyOf("g-a1b2c3d4"), "g-a1b2c3d4");
});

test("Roles - token endpoint ignores client identity/roomAdmin and applies threshold", async () => {
  await withServer(async (base) => {
    sfu.participants = 0;
    const host = await join(base, "rt-threshold", { userId: "hostuser" });
    assert.equal(host.body.role, "host");
    assert.match(host.body.identity, /^u-hostuser-[0-9a-f]{6}$/);

    const spoof = await join(base, "rt-threshold", {
      body: { identity: "u-hostuser-zzzzzz", roomAdmin: true },
    });
    assert.equal(spoof.body.role, "speaker");
    assert.equal(spoof.body.isHost, false);
    assert.match(spoof.body.identity, /^g-/);

    sfu.participants = 50;
    const late = await join(base, "rt-threshold");
    assert.equal(late.body.role, "attendee");
    assert.equal(decode(late.body.token).video.canPublish, false);

    // Host keeps host role on rejoin with a new identity (second tab).
    const again = await join(base, "rt-threshold", { userId: "hostuser" });
    assert.equal(again.body.role, "host");
    assert.notEqual(again.body.identity, host.body.identity);
  });
});

test("Roles - MAX_PARTICIPANTS returns 403 ROOM_FULL except for host", async () => {
  await withServer(async (base) => {
    sfu.participants = 0;
    await join(base, "rt-full", { userId: "fullhost" });
    sfu.participants = 100;
    const full = await join(base, "rt-full");
    assert.equal(full.status, 403);
    assert.equal(full.body.code, "ROOM_FULL");
    const host = await join(base, "rt-full", { userId: "fullhost" });
    assert.equal(host.status, 200);
  });
});

test("Roles - promote/demote requires host or cohost and updates LiveKit live", async () => {
  await withServer(async (base, emitted) => {
    sfu.participants = 0;
    sfu.updates = [];
    const host = await join(base, "rt-promote", { userId: "promohost" });
    sfu.participants = 60;
    const attendee = await join(base, "rt-promote", { userId: "aud1" });
    const other = await join(base, "rt-promote", { userId: "aud2" });
    assert.equal(attendee.body.role, "attendee");

    assert.equal((await setRole(base, "rt-promote", null, other.body.identity, "speaker")).status, 401);
    const denied = await setRole(base, "rt-promote", attendee.body.token, other.body.identity, "speaker");
    assert.equal(denied.status, 403);

    const ok = await setRole(base, "rt-promote", host.body.token, attendee.body.identity, "speaker");
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).live, true);
    assert.deepEqual(sfu.updates.at(-1).permission, grantsForRole("speaker"));
    assert.equal(sfu.updates.at(-1).metadata.role, "speaker");
    assert.ok(
      emitted.some(
        (e) =>
          e.event === "room-moderation" &&
          e.data.action === "role-changed" &&
          e.data.targetIdentity === attendee.body.identity
      )
    );

    // Stored by userId: the promoted user rejoins as speaker even above the threshold.
    const rejoin = await join(base, "rt-promote", { userId: "aud1" });
    assert.equal(rejoin.body.role, "speaker");
  });
});

test("Roles - only host manages cohosts; host role is immutable; offline target persists", async () => {
  await withServer(async (base) => {
    sfu.participants = 0;
    const host = await join(base, "rt-cohost", { userId: "cohhost" });
    const a = await join(base, "rt-cohost", { userId: "coa" });
    const b = await join(base, "rt-cohost", { userId: "cob" });

    assert.equal((await setRole(base, "rt-cohost", host.body.token, a.body.identity, "cohost")).status, 200);
    // Cohost cannot create another cohost or touch the host.
    assert.equal((await setRole(base, "rt-cohost", a.body.token, b.body.identity, "cohost")).status, 403);
    assert.equal((await setRole(base, "rt-cohost", a.body.token, host.body.identity, "attendee")).status, 403);
    // Cohost can demote a speaker; target offline still persists with live: false.
    sfu.connected = false;
    const res = await setRole(base, "rt-cohost", a.body.token, b.body.identity, "attendee");
    sfu.connected = true;
    assert.equal(res.status, 200);
    assert.equal((await res.json()).live, false);
    assert.equal((await join(base, "rt-cohost", { userId: "cob" })).body.role, "attendee");
  });
});

test("Roles - moderation rejects missing, foreign-room, and non-host tokens", async () => {
  await withServer(async (base) => {
    sfu.participants = 0;
    await join(base, "rt-mod", { userId: "modhost" });
    const speaker = await join(base, "rt-mod");
    const elsewhere = await join(base, "rt-mod-other");
    const post = (token) =>
      fetch(`${base}/api/v1/rooms/rt-mod/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "lock-room" }),
      });
    assert.equal((await post("bad.token.value")).status, 401);
    assert.equal((await post(elsewhere.body.token)).status, 403);
    assert.equal((await post(speaker.body.token)).status, 403);
  });
});

test("Roles - webhook parses application/webhook+json body", async () => {
  const { Room } = await import("../models/room.model.js");
  const original = Room.findOneAndUpdate;
  const calls = [];
  Room.findOneAndUpdate = async (filter, update) => calls.push({ filter, update });
  try {
    await withServer(async (base) => {
      const body = JSON.stringify({
        event: "participant_joined",
        room: { name: "rt-hook", numParticipants: 7 },
      });
      const sha256 = crypto.createHash("sha256").update(body).digest("base64");
      const token = jwt.sign({ sha256 }, process.env.LIVEKIT_API_SECRET || "devsecret", {
        issuer: "devkey",
      });
      // LiveKit signs the body hash as standard base64.
      assert.equal(verifyLiveKitWebhook(Buffer.from(body), token), true);
      assert.equal(verifyLiveKitWebhook(Buffer.from(body + " "), token), false);
      const res = await fetch(`${base}/api/v1/livekit/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/webhook+json", Authorization: token },
        body,
      });
      assert.equal(res.status, 200);
      assert.equal(calls[0].filter.roomId, "rt-hook");
      assert.equal(calls[0].update.participantCount, 7);
    });
  } finally {
    Room.findOneAndUpdate = original;
  }
});
