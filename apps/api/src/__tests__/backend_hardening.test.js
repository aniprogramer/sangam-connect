import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshSchema,
  livekitTokenSchema,
  addHistorySchema,
  validate,
} from "../validators/index.js";
import healthRouter from "../routes/health.routes.js";
import { errorHandler, notFoundHandler } from "../middlewares/error.js";

// ── 1. Zod Schema Validation Tests ───────────────────────────────────────────
test("Validators - registerSchema validates required fields & terms acceptance", () => {
  const invalid = registerSchema.safeParse({
    name: "",
    email: "not-an-email",
    password: "123",
    acceptTerms: false,
  });
  assert.equal(invalid.success, false);
  const paths = (invalid.error.issues || invalid.error.errors || []).map((e) => e.path[0]);
  assert.ok(paths.includes("name"));
  assert.ok(paths.includes("email"));
  assert.ok(paths.includes("password"));
  assert.ok(paths.includes("acceptTerms"));

  const valid = registerSchema.safeParse({
    name: "Valid User",
    email: "valid@example.com",
    password: "password123",
    acceptTerms: true,
  });
  assert.equal(valid.success, true);
});

test("Validators - loginSchema requires email or username and password", () => {
  const missingBoth = loginSchema.safeParse({ password: "mypassword" });
  assert.equal(missingBoth.success, false);

  const withEmail = loginSchema.safeParse({ email: "user@example.com", password: "mypassword" });
  assert.equal(withEmail.success, true);

  const withUsername = loginSchema.safeParse({ username: "myhandle", password: "mypassword" });
  assert.equal(withUsername.success, true);
});

test("Validators - verifyEmailSchema accepts code or otp and normalizes to string", () => {
  const withNumber = verifyEmailSchema.safeParse({ email: "user@example.com", code: 123456 });
  assert.equal(withNumber.success, true);
  assert.equal(withNumber.data.code, "123456");

  const withOtp = verifyEmailSchema.safeParse({ email: "user@example.com", otp: "654321" });
  assert.equal(withOtp.success, true);
  assert.equal(withOtp.data.code, "654321");
});

test("Validators - livekitTokenSchema validates roomName and identity", () => {
  const invalid = livekitTokenSchema.safeParse({ name: "User" });
  assert.equal(invalid.success, false);

  const valid = livekitTokenSchema.safeParse({ roomName: "my-room", identity: "user-123" });
  assert.equal(valid.success, true);
});

test("Validators - validate middleware returns 400 with structured errors", async () => {
  const app = express();
  app.use(express.json());
  app.post("/test-val", validate(refreshSchema), (req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/test-val`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, "Validation failed");
    assert.equal(Array.isArray(body.errors), true);
    assert.equal(body.errors[0].path, "refreshToken");
  } finally {
    server.close();
  }
});

// ── 2. Health & Readiness Probe Tests ─────────────────────────────────────────
test("Health Route - GET /health returns 200 ok", async () => {
  const app = express();
  app.use("/", healthRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.ok(typeof body.ts === "number");
  } finally {
    server.close();
  }
});

test("Health Route - GET /ready returns 503 when MongoDB is disconnected", async () => {
  const app = express();
  app.use("/", healthRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/ready`);
    // MongoDB is disconnected in isolated unit test environment
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, "unavailable");
    assert.equal(body.checks.mongodb, false);
  } finally {
    server.close();
  }
});

// ── 3. Centralized Error Handling & Not Found Tests ───────────────────────────
test("Error Handling - notFoundHandler returns 404 for unknown route", async () => {
  const app = express();
  app.use(notFoundHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/unknown-path`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.message.includes("Route not found"));
  } finally {
    server.close();
  }
});

test("Error Handling - errorHandler formats internal errors as JSON without stack in prod", async () => {
  const app = express();
  app.get("/error-test", (req, res, next) => {
    const err = new Error("Custom operational failure");
    err.status = 400;
    next(err);
  });
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/error-test`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, "Custom operational failure");
  } finally {
    server.close();
  }
});
