import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/email.service.js";

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

    const token = crypto.randomBytes(32).toString("hex");
    user.token = token;
    await user.save();

    return res.status(httpStatus.OK).json({
      token,
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
 * Current User (/me) - Restores active session
 */
const getCurrentUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.query.token || req.body.token;

  if (!token) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "No authentication token provided." });
  }

  try {
    const user = await User.findOne({ token });
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
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Failed to restore user session.",
    });
  }
};

/**
 * Logout handler - Clears session token
 */
const logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.query.token || req.body.token;

  if (token) {
    try {
      const user = await User.findOne({ token });
      if (user) {
        user.token = null;
        await user.save();
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  return res
    .status(httpStatus.OK)
    .json({ message: "Logged out successfully." });
};

const getUserHistory = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null) || req.query.token || req.body.token;

  try {
    const user = await User.findOne({ token: token });
    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
    }
    const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 });
    res.json(meetings);
  } catch (e) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong ${e}` });
  }
};

const addToHistory = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null) || req.body.token;
  const meeting_code = req.body.meeting_code || req.body.meetingCode;

  try {
    const user = await User.findOne({ token: token });
    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
    }

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
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null) || req.query.token || req.body.token;

  const meetingId = req.params.id || req.body.meetingId || req.body.id;

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
    }

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
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null) || req.query.token || req.body.token;

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
    }

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
  getCurrentUser,
  logout,
  getUserHistory,
  addToHistory,
  deleteHistoryItem,
  clearAllHistory,
};
