import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  addToHistory,
  clearAllHistory,
  deleteHistoryItem,
  getCurrentUser,
  getUserHistory,
  login,
  logout,
  refresh,
  register,
  resendVerification,
  verifyEmail,
} from "../controllers/user.controller.js";
import {
  validate,
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshSchema,
  logoutSchema,
  addHistorySchema,
} from "../validators/index.js";

const router = Router();

// Rate limiter for auth endpoints: max 10 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again later." },
});

// Rate limiter for refresh endpoint: max 30 requests per 15 minutes per IP
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many refresh attempts. Try again later." },
});

router.route("/login").post(authLimiter, validate(loginSchema), login);
router.route("/register").post(authLimiter, validate(registerSchema), register);
router.route("/verify-email").post(authLimiter, validate(verifyEmailSchema), verifyEmail);
router.route("/resend-verification").post(authLimiter, validate(resendVerificationSchema), resendVerification);
router.route("/refresh").post(refreshLimiter, validate(refreshSchema), refresh);
router.route("/me").get(getCurrentUser);
router.route("/logout").post(validate(logoutSchema), logout);

router.route("/add_to_activity").post(validate(addHistorySchema), addToHistory);
router.route("/get_all_activity").get(getUserHistory).post(getUserHistory);
router.route("/delete_activity").delete(deleteHistoryItem).post(deleteHistoryItem);
router.route("/delete_activity/:id").delete(deleteHistoryItem).post(deleteHistoryItem);
router.route("/clear_activity").delete(clearAllHistory).post(clearAllHistory);

router.get("/@:username/room", (req, res) => {
  const rawUsername = req.params.username.trim().toLowerCase();
  const cleanUsername = rawUsername.replace(/^@/, "");
  const roomId = `user-${cleanUsername}`;
  return res.status(200).json({
    username: cleanUsername,
    roomId,
    roomUrl: `/meet/@${cleanUsername}`,
    isPersonalRoom: true,
  });
});

export default router;

