import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";

import { validateConfig } from "../config/index.js";
import { corsOptions, corsOriginHandler } from "../config/cors.js";
import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  login,
  refresh,
  logout,
  getCurrentUser,
  getUserHistory,
} from "../controllers/user.controller.js";
import userRoutes from "../routes/users.routes.js";

const VALID_SECRET = "a".repeat(32);
const VALID_REFRESH_SECRET = "b".repeat(32);

// ── 1. Boot Config Validation Tests ──────────────────────────────────────────
test("Boot validation - throws when DATABASE_URL is missing", () => {
  assert.throws(
    () => {
      validateConfig({
        JWT_SECRET: VALID_SECRET,
        JWT_REFRESH_SECRET: VALID_REFRESH_SECRET,
      });
    },
    { message: "DATABASE_URL environment variable is required" }
  );
});

test("Boot validation - throws when JWT_SECRET is missing or < 32 chars", () => {
  assert.throws(
    () => {
      validateConfig({
        DATABASE_URL: "mongodb://localhost:27017/test",
        JWT_SECRET: "short-secret",
        JWT_REFRESH_SECRET: VALID_REFRESH_SECRET,
      });
    },
    /JWT_SECRET environment variable is required and must be at least 32 characters long/
  );
});

test("Boot validation - throws when JWT_REFRESH_SECRET is missing or < 32 chars", () => {
  assert.throws(
    () => {
      validateConfig({
        DATABASE_URL: "mongodb://localhost:27017/test",
        JWT_SECRET: VALID_SECRET,
        JWT_REFRESH_SECRET: "short-refresh",
      });
    },
    /JWT_REFRESH_SECRET environment variable is required and must be at least 32 characters long/
  );
});

test("Boot validation - accepts valid config and returns frozen object", () => {
  const config = validateConfig({
    DATABASE_URL: "mongodb://localhost:27017/test",
    JWT_SECRET: VALID_SECRET,
    JWT_REFRESH_SECRET: VALID_REFRESH_SECRET,
    PORT: "8002",
  });
  assert.equal(config.DATABASE_URL, "mongodb://localhost:27017/test");
  assert.equal(config.PORT, 8002);
  assert.ok(Object.isFrozen(config));
});

// ── 2. CORS Handler Tests ─────────────────────────────────────────────────────
test("CORS handler - permits requests with missing origin (curl/mobile/tools)", (t, done) => {
  corsOriginHandler(null, (err, allow) => {
    assert.equal(err, null);
    assert.equal(allow, true);
    done();
  });
});

test("CORS handler - permits requests from allowed origins", (t, done) => {
  corsOriginHandler("http://localhost:5173", (err, allow) => {
    assert.equal(err, null);
    assert.equal(allow, true);
    done();
  });
});

test("CORS handler - blocks requests from unauthorized origins", (t, done) => {
  corsOriginHandler("http://malicious-site.com", (err, allow) => {
    assert.ok(err instanceof Error);
    assert.match(err.message, /CORS blocked: http:\/\/malicious-site\.com/);
    done();
  });
});

// ── 3. JWT Contracts & Token Payload Tests ────────────────────────────────────
test("JWT Access Token - exact payload shape { sub, email, iss, iat, exp } and 15m expiry", () => {
  process.env.JWT_SECRET = VALID_SECRET;

  const mockUser = {
    _id: "64f1a2b3c4d5e6f7a8b9c0d1",
    email: "aniket@sangam.connect",
    username: "aniket",
  };

  const beforeTime = Math.floor(Date.now() / 1000);
  const token = generateAccessToken(mockUser);
  const afterTime = Math.floor(Date.now() / 1000);

  const decoded = jwt.verify(token, VALID_SECRET);
  assert.equal(decoded.sub, mockUser._id);
  assert.equal(decoded.email, mockUser.email);
  assert.equal(decoded.iss, "sangam");
  assert.ok(decoded.iat >= beforeTime && decoded.iat <= afterTime);
  assert.equal(decoded.exp - decoded.iat, 15 * 60, "Must have exactly 15 minutes validity");
});

// ── 4. Refresh Token Rotation & Reuse Detection Contract ─────────────────────
test("Refresh Token - Rotation and Reuse Detection logic", async () => {
  process.env.JWT_SECRET = VALID_SECRET;
  process.env.JWT_REFRESH_SECRET = VALID_REFRESH_SECRET;

  const mockUserId = "64f1a2b3c4d5e6f7a8b9c0d2";
  const mockUser = {
    _id: mockUserId,
    name: "Test User",
    email: "test@example.com",
    username: "testuser",
    publicCallId: "test-user-call-id",
    isEmailVerified: true,
  };

  // In-memory mock store for RefreshToken collection
  const mockTokens = new Map();

  const originalFindOne = RefreshToken.findOne;
  const originalUpdateMany = RefreshToken.updateMany;
  const originalCreate = RefreshToken.create;
  const originalFindById = User.findById;

  try {
    RefreshToken.create = async (doc) => {
      const record = { ...doc, _id: "tok_" + Math.random(), revokedAt: null, save: async function() {} };
      mockTokens.set(doc.tokenHash, record);
      return record;
    };

    RefreshToken.findOne = async (query) => {
      return mockTokens.get(query.tokenHash) || null;
    };

    RefreshToken.updateMany = async (query, update) => {
      for (const record of mockTokens.values()) {
        if (record.userId === query.userId && record.revokedAt === null) {
          record.revokedAt = update.revokedAt;
        }
      }
      return { modifiedCount: 1 };
    };

    User.findById = async (id) => (id === mockUserId ? mockUser : null);

    // 1. Generate initial refresh token
    const initialRawToken = await generateRefreshToken(mockUser);
    const initialHash = crypto.createHash("sha256").update(initialRawToken).digest("hex");
    assert.ok(mockTokens.has(initialHash));

    // 2. Perform valid refresh
    let refreshedResData = null;
    let refreshedStatusCode = null;
    const req1 = { body: { refreshToken: initialRawToken } };
    const res1 = {
      status: (code) => {
        refreshedStatusCode = code;
        return { json: (data) => { refreshedResData = data; } };
      },
    };

    await refresh(req1, res1);

    assert.equal(refreshedStatusCode, 200);
    assert.ok(refreshedResData.accessToken, "Must return new access token");
    assert.ok(refreshedResData.refreshToken, "Must return rotated refresh token");
    assert.notEqual(refreshedResData.refreshToken, initialRawToken, "Refresh token must rotate");

    // Old token should now be revoked
    const oldRecord = mockTokens.get(initialHash);
    assert.ok(oldRecord.revokedAt instanceof Date, "Old token must be marked revoked");

    // 3. Attempt reuse of old token (Reuse Detection)
    let reuseResData = null;
    let reuseStatusCode = null;
    const reqReuse = { body: { refreshToken: initialRawToken } };
    const resReuse = {
      status: (code) => {
        reuseStatusCode = code;
        return { json: (data) => { reuseResData = data; } };
      },
    };

    await refresh(reqReuse, resReuse);

    assert.equal(reuseStatusCode, 401);
    assert.equal(reuseResData.message, "Refresh token reuse detected. Please sign in again.");

    // All active tokens for the user must now be revoked
    const newHash = crypto.createHash("sha256").update(refreshedResData.refreshToken).digest("hex");
    const newRecord = mockTokens.get(newHash);
    assert.ok(newRecord.revokedAt instanceof Date, "All user tokens must be revoked on reuse");
  } finally {
    RefreshToken.findOne = originalFindOne;
    RefreshToken.updateMany = originalUpdateMany;
    RefreshToken.create = originalCreate;
    User.findById = originalFindById;
  }
});

// ── 5. Logout Contract (Amendment 12) ─────────────────────────────────────────
test("Logout contract - revokes refresh token without requiring access token", async () => {
  const rawToken = "sample-refresh-token-xyz";
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  let recordSaved = false;
  const mockRecord = {
    tokenHash,
    revokedAt: null,
    save: async () => { recordSaved = true; },
  };

  const originalFindOne = RefreshToken.findOne;
  RefreshToken.findOne = async () => mockRecord;

  try {
    let statusCode = null;
    let resData = null;
    const req = { body: { refreshToken: rawToken }, headers: {} };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { resData = data; } };
      },
    };

    await logout(req, res);

    assert.equal(statusCode, 200);
    assert.equal(resData.message, "Logged out");
    assert.ok(mockRecord.revokedAt instanceof Date);
    assert.equal(recordSaved, true);
  } finally {
    RefreshToken.findOne = originalFindOne;
  }
});

// ── 6. History Auth Contract (Amendment 10) ──────────────────────────────────
test("History contract - rejects requests lacking Authorization header with 401", async () => {
  let statusCode = null;
  let resData = null;
  const req = {
    headers: {},
    query: { token: "query-token-must-be-ignored" },
    body: { token: "body-token-must-be-ignored" },
  };
  const res = {
    status: (code) => {
      statusCode = code;
      return { json: (data) => { resData = data; } };
    },
  };

  await getUserHistory(req, res);

  assert.equal(statusCode, 401);
  assert.equal(resData.message, "Authentication required");
});

// ── 7. Rate Limiter Route Integration ────────────────────────────────────────
test("Rate Limiter - returns 429 after exceeding limit on /refresh", async () => {
  const originalFindOne = RefreshToken.findOne;
  RefreshToken.findOne = async () => null;

  const app = express();
  app.use(express.json());
  app.use("/api/v1/users", userRoutes);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    let lastStatus = null;
    let lastBody = null;

    // Send 31 requests to /refresh (limit is 30)
    for (let i = 0; i < 32; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/users/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "dummy" }),
      });
      lastStatus = res.status;
      lastBody = await res.json();
      if (res.status === 429) break;
    }

    assert.equal(lastStatus, 429);
    assert.equal(lastBody.message, "Too many refresh attempts. Try again later.");
  } finally {
    RefreshToken.findOne = originalFindOne;
    await new Promise((resolve) => server.close(resolve));
  }
});
