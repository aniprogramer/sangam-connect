import pino from "pino";
import config from "../config/index.js";

export const logger = pino({
  level: config.NODE_ENV === "test" ? "silent" : (process.env.LOG_LEVEL || "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.refreshToken",
      "req.body.token",
      "req.body.code",
      "req.body.otp",
      "password",
      "refreshToken",
      "token",
      "code",
      "otp",
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
