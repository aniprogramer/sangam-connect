import { Router } from "express";
import {
  addToHistory,
  clearAllHistory,
  deleteHistoryItem,
  getCurrentUser,
  getUserHistory,
  login,
  logout,
  register,
  resendVerification,
  verifyEmail,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/verify-email").post(verifyEmail);
router.route("/resend-verification").post(resendVerification);
router.route("/me").get(getCurrentUser);
router.route("/logout").post(logout);

router.route("/add_to_activity").post(addToHistory);
router.route("/get_all_activity").get(getUserHistory).post(getUserHistory);
router.route("/delete_activity").delete(deleteHistoryItem).post(deleteHistoryItem);
router.route("/delete_activity/:id").delete(deleteHistoryItem).post(deleteHistoryItem);
router.route("/clear_activity").delete(clearAllHistory).post(clearAllHistory);

export default router;
