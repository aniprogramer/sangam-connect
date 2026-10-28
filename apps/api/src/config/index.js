import "dotenv/config";

/**
 * Validates environment variables and returns a frozen configuration object.
 * Throws descriptive errors if required variables are missing or insecure.
 */
export const validateConfig = (env = process.env) => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable is required and must be at least 32 characters long"
    );
  }

  if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET environment variable is required and must be at least 32 characters long"
    );
  }

  return Object.freeze({
    DATABASE_URL: env.DATABASE_URL,
    PORT: parseInt(env.PORT, 10) || 8002,
    JWT_SECRET: env.JWT_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    CLIENT_ORIGINS: env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:3000",
    ROOM_GRACE_PERIOD_MS: parseInt(env.ROOM_GRACE_PERIOD_MS, 10) || 15 * 60 * 1000,
    LIVEKIT_API_KEY: env.LIVEKIT_API_KEY || "devkey",
    LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET || "devsecret",
    LIVEKIT_URL: env.LIVEKIT_URL || (env.NODE_ENV === "production" ? "wss://sangam.livekit.cloud" : "ws://localhost:7880"),
    REDIS_URL: env.REDIS_URL || "",
    LARGE_ROOM_THRESHOLD: parseInt(env.LARGE_ROOM_THRESHOLD, 10) || 50,
    MAX_PARTICIPANTS: parseInt(env.MAX_PARTICIPANTS, 10) || 500,
    NODE_ENV: env.NODE_ENV || "development",
  });
};

const isTest =
  process.env.NODE_ENV === "test" ||
  process.env.npm_lifecycle_event === "test" ||
  process.argv.some((arg) => arg.includes("test"));

let config;
try {
  config = validateConfig(process.env);
} catch (error) {
  if (isTest) {
    config = {
      DATABASE_URL: process.env.DATABASE_URL || "",
      PORT: parseInt(process.env.PORT, 10) || 8002,
      JWT_SECRET: process.env.JWT_SECRET || "",
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
      CLIENT_ORIGINS: process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:3000",
      ROOM_GRACE_PERIOD_MS: parseInt(process.env.ROOM_GRACE_PERIOD_MS, 10) || 15 * 60 * 1000,
      NODE_ENV: "test",
    };
  } else {
    console.error(`[FATAL CONFIG ERROR] ${error.message}`);
    process.exit(1);
  }
}

export default config;
