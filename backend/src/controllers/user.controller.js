/**
 * User Controller
 * Handles user authentication operations including login and registration
 * Uses bcrypt for password hashing and crypto for token generation
 */

import { User } from "../models/user.model.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";

/**
 * Login handler - Authenticates user with username and password
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.username - User's username
 * @param {string} req.body.password - User's password
 * @param {Object} res - Express response object
 * @returns {Object} Returns authentication token on success
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  // Validate required fields
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Please provide username and password" });
  }

  try {
    // Query database for user by username
    const user = await User.findOne({ username });

    // Handle user not found scenario
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User Not Found!" });
    }

    // Verify password against hashed password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Generate secure random token for session management
      const token = crypto.randomBytes(20).toString("hex");

      // Store token in database for later verification
      user.token = token;
      await user.save();

      return res.status(httpStatus.OK).json({ token });
    } else {
      // Invalid password response
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid credentials" });
    }
  } catch (error) {
    // Log error and return generic error response for security
    console.error("Login error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Authentication failed. Please try again.",
    });
  }
};

/**
 * Register handler - Creates new user account with hashed password
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - User's full name
 * @param {string} req.body.username - User's desired username (unique identifier)
 * @param {string} req.body.password - User's password (will be hashed)
 * @param {Object} res - Express response object
 * @returns {Object} Returns success message on account creation
 */
const register = async (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, username and password" });
  }

  if (typeof name !== "string" || typeof username !== "string" || typeof password !== "string") {
    return res
      .status(400)
      .json({ message: "name, username and password must be strings" });
  }

  if (!name.trim() || !username.trim() || !password.trim()) {
    return res
      .status(400)
      .json({ message: "name, username and password cannot be empty" });
  }

  try {
    // Check if user with this username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "Username already exists. Please choose another." });
    }

    // Hash password using bcrypt with salt rounds of 10 for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user document with hashed password
    const newUser = new User({
      name,
      username,
      password: hashedPassword,
    });

    // Persist user to database
    await newUser.save();

    res
      .status(httpStatus.CREATED)
      .json({ message: "User registered successfully" });
  } catch (error) {
    // Log error for debugging purposes
    console.error("Registration error:", error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Registration failed. Please try again.",
    });
  }
};

export { login, register };
