import { z } from "zod";
import httpStatus from "http-status";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Please provide name, email, and password."),
  email: z.string().trim().toLowerCase().email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }),
  }),
});

export const loginSchema = z
  .object({
    email: z.string().trim().optional(),
    username: z.string().trim().optional(),
    password: z.string().min(1, "Please provide password."),
  })
  .refine((data) => data.email || data.username, {
    message: "Please provide email or username and password.",
    path: ["email"],
  });

export const verifyEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Please provide a valid email address."),
    code: z.union([z.string(), z.number()]).optional(),
    otp: z.union([z.string(), z.number()]).optional(),
  })
  .refine((data) => data.code || data.otp, {
    message: "Email and verification code are required.",
    path: ["code"],
  })
  .transform((data) => ({
    ...data,
    code: (data.code || data.otp).toString().trim(),
  }));

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email is required."),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required."),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const livekitTokenSchema = z.object({
  roomName: z.string().trim().min(1, "roomName is required."),
  identity: z.string().trim().min(1, "identity is required."),
  name: z.string().trim().optional(),
  isGuest: z.boolean().optional(),
  avatar: z.string().nullable().optional(),
  roomAdmin: z.boolean().optional(),
});

export const chatMessageSchema = z.object({
  roomId: z.string().trim().min(1, "roomId is required."),
  text: z.string().min(1, "text is required.").max(2000),
  senderName: z.string().trim().min(1, "senderName is required."),
  senderId: z.string().trim().optional(),
});

export const addHistorySchema = z
  .object({
    meeting_code: z.string().trim().optional(),
    meetingCode: z.string().trim().optional(),
  })
  .refine((data) => data.meeting_code || data.meetingCode, {
    message: "meeting_code is required.",
    path: ["meeting_code"],
  });

export const moderationSchema = z.object({
  action: z.enum([
    "mute-all",
    "mute-individual",
    "remove-participant",
    "lock-room",
    "unlock-room",
    "transfer-host",
    "toggle-waiting-room",
  ]),
  targetIdentity: z.string().optional(),
  callerIdentity: z.string().optional(),
});

export const recordingSchema = z.object({
  callerIdentity: z.string().optional(),
});

export const breakoutSchema = z.object({
  rooms: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      participants: z.array(z.string()).default([]),
    })
  ),
  callerIdentity: z.string().optional(),
});

export const chatUploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileData: z.string().min(1),
  fileSize: z.number().optional(),
});

/**
 * Express middleware to validate request body against a Zod schema.
 * Returns 400 Bad Request with standardized error details on failure.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errorDetails = (result.error.issues || result.error.errors || []).map((err) => ({
      path: err.path.join("."),
      message: err.message,
    }));
    return res.status(httpStatus.BAD_REQUEST).json({
      message: "Validation failed",
      errors: errorDetails,
    });
  }
  req.body = result.data;
  next();
};
