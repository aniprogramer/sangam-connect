import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/email.service.js";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generateAccessToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      iss: "sangam",
      iat: now,
      exp: now + 15 * 60, // 15 minutes
    },
    secret
  );
};

export const generateRefreshToken = async (user) => {
  const rawToken = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  return rawToken;
};

const authenticateRequest = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.sub);
    return user || null;
  } catch (err) {
    return null;
  }
};

/**
 * Generates a unique, URL-safe publicCallId from name + random suffix
 * Example: aniket-de-7x92
 */
const generatePublicCallId = async (name) => {
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 15);
  
  const baseSlug = cleanName || "user";
  
  // Try up to 5 times to ensure uniqueness
  for (let i = 0; i < 5; i++) {
    const randomSuffix = crypto.randomBytes(2).toString("hex");
    const candidateId = `${baseSlug}-${randomSuffix}`;
    const exists = await User.findOne({ publicCallId: candidateId });
    if (!exists) {
      return candidateId;
    }
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
};

/**
 * Register handler - Creates new user or updates unverified registration
 */
const register = async (req, res) => {
  const { name, email, password, acceptTerms } = req.body;

  if (!name || !email || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Please provide name, email, and password." });
  }

  if (acceptTerms !== true) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "You must accept the Terms of Service and Privacy Policy." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Please provide a valid email address." });
  }

  if (password.length < 6) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Password must be at least 6 characters long." });
  }

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });

    // Handle existing verified user
    if (existingUser && existingUser.isEmailVerified) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "Email already registered. Please sign in." });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existingUser && !existingUser.isEmailVerified) {
      // Reuse existing unverified account: update details & send new OTP
      existingUser.name = name.trim();
      existingUser.password = await bcrypt.hash(password, 10);
      existingUser.verificationCodeHash = otpHash;
      existingUser.verificationExpiresAt = otpExpires;
      existingUser.verificationAttempts = 0;
      existingUser.lastResendAt = new Date();
      await existingUser.save();

      // Dispatch email via Nodemailer / fallback console
      const emailRes = await sendVerificationEmail(normalizedEmail, otp, name.trim());

      return res.status(httpStatus.OK).json({
        message: "Registration updated. A verification code has been sent to your email.",
        email: normalizedEmail,
        ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
      });
    }

    // New User Registration
    const publicCallId = await generatePublicCallId(name);
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      publicCallId,
      username: publicCallId, // Mapped for backward compatibility
      password: hashedPassword,
      isEmailVerified: false,
      verificationCodeHash: otpHash,
      verificationExpiresAt: otpExpires,
      verificationAttempts: 0,
      lastResendAt: new Date(),
    });

    await newUser.save();

    // Dispatch email via Nodemailer / fallback console
    const emailRes = await sendVerificationEmail(normalizedEmail, otp, name.trim());

    return res.status(httpStatus.CREATED).json({
      message: "Registration successful. Please check your email for the verification code.",
      email: normalizedEmail,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Registration failed. Please try again.",
    });
  }
};

/**
 * Verify Email handler - Verifies 6-digit OTP
 */
const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Email and verification code are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.toString().trim();

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User account not found." });
    }

    if (user.isEmailVerified) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Email is already verified. Please sign in." });
    }

    if (!user.verificationCodeHash || !user.verificationExpiresAt) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "No active verification code found. Please request a new code." });
    }

    // Check max attempts
    if (user.verificationAttempts >= 5) {
      user.verificationCodeHash = null;
      user.verificationExpiresAt = null;
      await user.save();
      return res.status(httpStatus.BAD_REQUEST).json({
        message: "Maximum verification attempts exceeded. Please request a new verification code.",
      });
    }

    // Check expiration
    if (new Date() > new Date(user.verificationExpiresAt)) {
      user.verificationCodeHash = null;
      user.verificationExpiresAt = null;
      await user.save();
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Verification code has expired. Please request a new code." });
    }

    // Compare code
    const isMatch = await bcrypt.compare(cleanCode, user.verificationCodeHash);

    if (!isMatch) {
      user.verificationAttempts += 1;
      await user.save();
      const remainingAttempts = 5 - user.verificationAttempts;
      return res.status(httpStatus.BAD_REQUEST).json({
        message: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
      });
    }

    // Mark verified & clear OTP
    user.isEmailVerified = true;
    user.verificationCodeHash = null;
    user.verificationExpiresAt = null;
    user.verificationAttempts = 0;
    await user.save();

    return res.status(httpStatus.OK).json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Verification failed. Please try again.",
    });
  }
};

/**
 * Resend Verification handler - Generates fresh OTP with 60s cooldown
 */
const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Email is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User account not found." });
    }

    if (user.isEmailVerified) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Email is already verified. Please sign in." });
    }

    // 60-second cooldown check
    if (user.lastResendAt) {
      const timeElapsed = Date.now() - new Date(user.lastResendAt).getTime();
      if (timeElapsed < 60000) {
        const remainingSecs = Math.ceil((60000 - timeElapsed) / 1000);
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
          message: `Please wait ${remainingSecs} second(s) before requesting another code.`,
          cooldownRemaining: remainingSecs,
        });
      }
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    user.verificationCodeHash = otpHash;
    user.verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.verificationAttempts = 0;
    user.lastResendAt = new Date();
    await user.save();

    await sendVerificationEmail(normalizedEmail, otp, user.name);

    return res.status(httpStatus.OK).json({
      message: "A new verification code has been sent to your email.",
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Could not resend verification code. Please try again.",
    });
  }
};

/**
 * Login handler - Authenticates with Email & Password
 */
const login = async (req, res) => {
  const { email, username, password } = req.body;
  const loginIdentifier = (email || username || "").trim().toLowerCase();

  if (!loginIdentifier || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Please provide email/username and password." });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: loginIdentifier },
        { username: loginIdentifier },
        { publicCallId: loginIdentifier },
      ],
    });

    if (!user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid email or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid email or password." });
    }

    if (!user.isEmailVerified) {
      return res.status(httpStatus.FORBIDDEN).json({
        message: "Your email is not verified. Please verify your email before logging in.",
        unverified: true,
        email: user.email,
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    return res.status(httpStatus.OK).json({
      accessToken,
      refreshToken,
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        publicCallId: user.publicCallId || user.username,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Authentication failed. Please try again.",
    });
  }
};

/**
 * Refresh Token handler (Amendment 4 & Amendment 8)
 * Rotates refresh tokens and detects reuse
 */
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Refresh token is required." });
  }

  try {
    const tokenHash = hashToken(refreshToken);
    const record = await RefreshToken.findOne({ tokenHash });

    if (!record) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid refresh token" });
    }

    // Reuse detection (Amendment 4)
    if (record.revokedAt != null) {
      await RefreshToken.updateMany(
        { userId: record.userId, revokedAt: null },
        { revokedAt: new Date() }
      );
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          event: "refresh_token_reuse_detected",
          userId: record.userId.toString(),
        })
      );
      return res.status(httpStatus.UNAUTHORIZED).json({
        message: "Refresh token reuse detected. Please sign in again.",
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Refresh token expired" });
    }

    // Valid token: revoke current record, mint new refresh token, mint new access token
    record.revokedAt = new Date();
    await record.save();

    const user = await User.findById(record.userId);
    if (!user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "User not found" });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user);

    return res.status(httpStatus.OK).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      token: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        publicCallId: user.publicCallId || user.username,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to refresh token.",
    });
  }
};

/**
 * Current User (/me) - Restores active session using Bearer JWT
 */
const getCurrentUser = async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "Invalid or expired session token." });
  }

  return res.status(httpStatus.OK).json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      publicCallId: user.publicCallId || user.username,
      isEmailVerified: user.isEmailVerified,
    },
  });
};

/**
 * Logout handler - Revokes refresh token (Amendment 12)
 * Does not require a valid access token
 */
const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      const tokenHash = hashToken(refreshToken);
      const record = await RefreshToken.findOne({ tokenHash });
      if (record && !record.revokedAt) {
        record.revokedAt = new Date();
        await record.save();
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  return res
    .status(httpStatus.OK)
    .json({ message: "Logged out" });
};

const getUserHistory = async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "Authentication required" });
  }

  try {
    const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 });
    res.json(meetings);
  } catch (e) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong ${e}` });
  }
};

const addToHistory = async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "Authentication required" });
  }

  const meeting_code = req.body.meeting_code || req.body.meetingCode;

  try {
    const newMeeting = new Meeting({
      user_id: user.username,
      meetingCode: meeting_code,
    });

    await newMeeting.save();

    res.status(httpStatus.CREATED).json({ message: "Added code to history" });
  } catch (e) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong ${e}` });
  }
};

const deleteHistoryItem = async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "Authentication required" });
  }

  const meetingId = req.params.id || req.body.meetingId || req.body.id;

  try {
    const meeting = await Meeting.findOneAndDelete({
      _id: meetingId,
      user_id: user.username,
    });

    if (!meeting) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "History item not found" });
    }

    return res.status(httpStatus.OK).json({ message: "Meeting history deleted successfully" });
  } catch (e) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Failed to delete history item: ${e.message}` });
  }
};

const clearAllHistory = async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "Authentication required" });
  }

  try {
    await Meeting.deleteMany({ user_id: user.username });
    return res.status(httpStatus.OK).json({ message: "All meeting history cleared successfully" });
  } catch (e) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Failed to clear history: ${e.message}` });
  }
};

export {
  login,
  register,
  verifyEmail,
  resendVerification,
  refresh,
  getCurrentUser,
  logout,
  getUserHistory,
  addToHistory,
  deleteHistoryItem,
  clearAllHistory,
};
