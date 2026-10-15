import nodemailer from "nodemailer";

/**
 * Creates a Nodemailer transporter based on environment configuration or Ethereal test account
 */
const createTransporter = async () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  // 1. If explicit SMTP credentials are set in environment, use them
  if (user && pass) {
    return nodemailer.createTransport({
      host: host || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }

  // 2. Otherwise in development mode, attempt generating an Ethereal test account
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch (err) {
    console.warn("[EMAIL SERVICE] Ethereal test account creation failed, using console fallback:", err.message);
    return null;
  }
};

/**
 * Sends a styled HTML Email verification OTP to the recipient
 */
export const sendVerificationEmail = async (toEmail, otpCode, name = "User") => {
  const normalizedEmail = toEmail.trim().toLowerCase();

  // Always log to terminal console for local development convenience
  console.log(`\n==================================================`);
  console.log(`[ANTAR SETU EMAIL SERVICE]`);
  console.log(`To: ${normalizedEmail}`);
  console.log(`Verification OTP: ${otpCode}`);
  console.log(`Expires in: 10 minutes`);
  console.log(`==================================================\n`);

  try {
    const transporter = await createTransporter();
    if (!transporter) {
      return { success: false, mode: "console_only" };
    }

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || '"Antar Setu" <no-reply@antarsetu.com>';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #0B0E15; color: #FFFFFF; margin: 0; padding: 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #141721; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 36px; box-shadow: 0 12px 36px rgba(0,0,0,0.5); }
          .logo { color: #FD622B; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
          .heading { font-size: 20px; font-weight: 700; color: #FFFFFF; margin-bottom: 12px; }
          .text { font-size: 14px; color: #A5A8B3; line-height: 1.6; margin-bottom: 24px; }
          .otp-box { background: rgba(253, 98, 43, 0.1); border: 2px dashed #FD622B; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #FD622B; font-family: monospace; }
          .footer { font-size: 12px; color: #6C7280; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎥 Antar Setu</div>
          <div class="heading">Verify Your Email Address</div>
          <p class="text">Hello ${name},<br>Welcome to Antar Setu! Please use the following 6-digit verification code to complete your registration:</p>
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
          </div>
          <p class="text">This code will expire in <strong>10 minutes</strong>. If you did not request this verification, please ignore this email.</p>
          <div class="footer">
            Antar Setu — Connect Seamlessly. Bridging Distances.
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: senderEmail,
      to: normalizedEmail,
      subject: `${otpCode} is your Antar Setu verification code`,
      text: `Hello ${name}, your Antar Setu verification code is: ${otpCode}. It expires in 10 minutes.`,
      html: htmlContent,
    });

    console.log(`[EMAIL SERVICE] Email dispatched successfully to ${normalizedEmail}. MessageId: ${info.messageId}`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`[EMAIL SERVICE] Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${normalizedEmail}:`, err.message);
    return { success: false, error: err.message };
  }
};
