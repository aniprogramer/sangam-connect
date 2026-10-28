import "dotenv/config";

export const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const corsOriginHandler = (origin, callback) => {
  if (!origin) return callback(null, true); // curl, mobile, server-to-server
  if (allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error(`CORS blocked: ${origin}`));
};

export const corsOptions = {
  origin: corsOriginHandler,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
