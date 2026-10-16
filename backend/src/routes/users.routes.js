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

router.route("/login").post(authLimiter, login);
router.route("/register").post(authLimiter, register);
router.route("/verify-email").post(authLimiter, verifyEmail);
router.route("/resend-verification").post(authLimiter, resendVerification);
router.route("/refresh").post(refreshLimiter, refresh);
router.route("/me").get(getCurrentUser);
router.route("/logout").post(logout);

router.route("/add_to_activity").post(addToHistory);
router.route("/get_all_activity").get(getUserHistory).post(getUserHistory);
router.route("/delete_activity").delete(deleteHistoryItem).post(deleteHistoryItem);
router.route("/delete_activity/:id").delete(deleteHistoryItem).post(deleteHistoryItem);
router.route("/clear_activity").delete(clearAllHistory).post(clearAllHistory);

export default router;
