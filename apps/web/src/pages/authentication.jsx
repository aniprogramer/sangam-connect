import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import styles from "../styles/auth.module.css";
import ThemeToggle from "../components/ui/ThemeToggle";

// SVG Icons
const UserIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="7" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CameraFeatureIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 8-6 4 6 4V8Z" />
    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
  </svg>
);

const UsersFeatureIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ShieldFeatureIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default function Authentication() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Mode: 0 = LOGIN, 1 = REGISTER, 2 = VERIFY_EMAIL
  const [mode, setMode] = useState(1);

  // Form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP inputs (6 digits)
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRef0 = useRef(null);
  const otpRef1 = useRef(null);
  const otpRef2 = useRef(null);
  const otpRef3 = useRef(null);
  const otpRef4 = useRef(null);
  const otpRef5 = useRef(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];

  // Resend OTP countdown
  const [cooldown, setCooldown] = useState(0);

  // UI state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    handleRegister,
    handleVerifyEmail,
    handleResendVerification,
    handleLogin,
    pendingVerifyEmail,
  } = useContext(AuthContext);

  const location = useLocation();
  const navigate = useNavigate();

  // Sync mode with route path (defaults to Register per reference design)
  useEffect(() => {
    if (location.pathname === "/login") {
      setMode(0);
    } else if (location.pathname === "/verify-email") {
      setMode(2);
    } else {
      setMode(1);
    }
  }, [location.pathname]);

  // Auto-populate pending email if returning to verification
  useEffect(() => {
    if (pendingVerifyEmail && mode === 2) {
      setEmail(pendingVerifyEmail);
    }
  }, [pendingVerifyEmail, mode]);

  // Handle Resend Cooldown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const resetFormFields = useCallback(() => {
    setName("");
    setPassword("");
    setConfirmPassword("");
    setAcceptTerms(false);
    setOtpDigits(["", "", "", "", "", ""]);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const handleModeSwitch = (newMode) => {
    clearMessages();
    resetFormFields();
    setMode(newMode);
    if (newMode === 0) {
      navigate("/login");
    } else if (newMode === 2) {
      navigate("/verify-email");
    } else {
      navigate("/register");
    }
  };

  // Input validation
  const validateRegister = () => {
    if (!name.trim()) {
      setError("Please enter your full name.");
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    if (!acceptTerms) {
      setError("Please agree to Sangam's Terms and Privacy Policy.");
      return false;
    }
    return true;
  };

  const validateLogin = () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return false;
    }
    if (!password) {
      setError("Please enter your password.");
      return false;
    }
    return true;
  };

  // Submit Register
  const onSubmitRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!validateRegister()) return;

    setIsSubmitting(true);
    try {
      const res = await handleRegister(name, email, password, acceptTerms);
      setSuccess(
        res.message || "Registration successful! Verification code sent to email."
      );
      if (res?.devOtp) setDevOtp(res.devOtp);
      resetFormFields();
      navigate("/verify-email");
      setCooldown(60);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Registration failed. Please check your details and try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Login
  const onSubmitLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!validateLogin()) return;

    setIsSubmitting(true);
    try {
      await handleLogin(email, password);
      resetFormFields();
      setEmail("");
    } catch (err) {
      const isUnverified = err?.response?.data?.unverified;
      const msg =
        err?.response?.data?.message || "Login failed. Invalid email or password.";
      setError(msg);

      if (isUnverified) {
        if (err?.response?.data?.email) {
          setEmail(err.response.data.email);
        }
        setTimeout(() => {
          navigate("/verify-email");
          setSuccess("Please enter the verification code sent to your email.");
        }, 1500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP Handling
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1);
    setOtpDigits(newOtp);

    // Auto-advance focus
    if (value && index < 5 && otpRefs[index + 1].current) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0 && otpRefs[index - 1].current) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split("");
      setOtpDigits(digits);
      if (otpRefs[5].current) otpRefs[5].current.focus();
    }
  };

  // Submit OTP Verification
  const onSubmitVerify = async (e) => {
    e.preventDefault();
    clearMessages();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await handleVerifyEmail(email, code);
      setSuccess(res.message || "Email verified! Redirecting to sign in...");
      resetFormFields();
      setTimeout(() => {
        navigate("/login");
        setSuccess("Account verified. Please sign in with your credentials.");
      }, 1500);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Verification failed. The code may be invalid or expired.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP
  const onResendOtp = async () => {
    if (cooldown > 0) return;
    clearMessages();
    try {
      const res = await handleResendVerification(email);
      setSuccess(res.message || "A fresh verification code has been sent.");
      if (res?.devOtp) setDevOtp(res.devOtp);
      setCooldown(60);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Could not resend code. Please try again.";
      setError(msg);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Background Lighting & Grid */}
      <div className={styles.bgAtmosphere} aria-hidden="true">
        <div className={styles.glowOrbTopRight} />
        <div className={styles.glowOrbCenter} />
        <div className={styles.glowOrbBottomLeft} />
        <div className={styles.gridPattern} />
      </div>

      {/* Top Header / Branding Bar */}
      <header className={styles.topHeader}>
        <Link to="/" className={styles.brandLink} title="Sangam Connect Home">
          <img
            src="/assets/branding/sangam-logo.png"
            alt="Sangam Connect"
            className={styles.brandLogo}
          />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ThemeToggle />
          <div className={styles.langSelector} role="button" tabIndex={0} title="Language selector">
            <span>EN</span>
            <ChevronDownIcon />
          </div>
        </div>
      </header>

      {/* Main Two-Column Viewport Content */}
      <main className={styles.mainContent}>
        {/* Left Section: Branding, Features & Center Visual */}
        <div className={styles.leftSection}>
          <div className={styles.leftTextCol}>
            {/* Eyebrow Label */}
            <div className={styles.eyebrowPill}>
              <span className={styles.eyebrowDot} />
              <span>VIDEO &bull; VOICE &bull; COMMUNITY</span>
            </div>

            {/* Headline */}
            <h1 className={styles.headline}>
              Where Voices
              <span className={styles.headlineAccent}>Converge</span>
            </h1>

            {/* Subtitle */}
            <p className={styles.subtext}>
              A modern communication platform connecting people through low-latency video and meaningful conversations.
            </p>

            {/* Feature Rows */}
            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <CameraFeatureIcon />
                </div>
                <div className={styles.featureTextBox}>
                  <div className={styles.featureTitle}>Crystal clear meetings</div>
                  <p className={styles.featureDesc}>High quality, low data usage</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <UsersFeatureIcon />
                </div>
                <div className={styles.featureTextBox}>
                  <div className={styles.featureTitle}>Communities & Channels</div>
                  <p className={styles.featureDesc}>Bring teams and friends together</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIconBox}>
                  <ShieldFeatureIcon />
                </div>
                <div className={styles.featureTextBox}>
                  <div className={styles.featureTitle}>Secure and private</div>
                  <p className={styles.featureDesc}>Your conversations, your control</p>
                </div>
              </div>
            </div>

            {/* Bottom Avatars & Tagline Row */}
            <div className={styles.bottomMetaRow}>
              <img
                src={isDark ? "/assets/avatars_stack_transparent.png" : "/assets/avatars_light.png"}
                alt="Community participants"
                className={styles.avatarsImg}
              />
              <div className={styles.metaTextGroup}>
                <div className={styles.metaLine1}>PEOPLE &bull; IDEAS &bull; CONVERSATIONS</div>
                <div className={styles.metaLine2}>ALL IN ONE PLACE</div>
              </div>
            </div>
          </div>

          {/* Center Visual: Floating 3D Participant Tiles & Orbital Trails */}
          <div className={styles.centerVisualCol} aria-hidden="true">
            <img
              src={isDark ? "/assets/hero_illustration_transparent.png" : "/assets/hero_illustration_light.png"}
              alt="Interactive Video Conference Visual"
              className={styles.heroVisualImg}
            />
          </div>
        </div>

        {/* Right Section: Registration Card */}
        <div className={styles.rightCardCol}>
          <div className={styles.registerCard}>
            {/* Heading & Subtitle */}
            <h2 className={styles.cardHeading}>
              {mode === 0 ? "Welcome Back" : mode === 1 ? "Create your account" : "Verify your email"}
            </h2>
            <p className={styles.cardSubtitle}>
              {mode === 0 && "Sign in to access your meetings and community."}
              {mode === 1 && "Join Sangam Connect to start and join instant meetings."}
              {mode === 2 && `Enter the 6-digit verification code sent to ${email || "your email"}.`}
            </p>

            {/* Two-Option Segmented Control (Hidden during OTP verify) */}
            {mode !== 2 && (
              <div className={styles.segmentedControl} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 0}
                  className={`${styles.tabSegment} ${mode === 0 ? styles.tabSegmentActive : ""}`}
                  onClick={() => handleModeSwitch(0)}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 1}
                  className={`${styles.tabSegment} ${mode === 1 ? styles.tabSegmentActive : ""}`}
                  onClick={() => handleModeSwitch(1)}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Feedback Alerts */}
            {error && <div className={styles.alertBannerError} role="alert">{error}</div>}
            {success && <div className={styles.alertBannerSuccess} role="status">{success}</div>}

            {/* MODE 1: CREATE ACCOUNT (PRIMARY SPECIFICATION) */}
            {mode === 1 && (
              <form onSubmit={onSubmitRegister} noValidate>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel} htmlFor="reg-name">
                    Full Name
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.leadingIcon}>
                      <UserIcon />
                    </span>
                    <input
                      id="reg-name"
                      type="text"
                      className={styles.inputField}
                      placeholder="Aniket Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel} htmlFor="reg-email">
                    Email Address
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.leadingIcon}>
                      <MailIcon />
                    </span>
                    <input
                      id="reg-email"
                      type="email"
                      className={styles.inputField}
                      placeholder="you@college.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel} htmlFor="reg-password">
                    Password
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.leadingIcon}>
                      <LockIcon />
                    </span>
                    <input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      className={styles.inputField}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.trailingBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel} htmlFor="reg-confirm">
                    Confirm Password
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.leadingIcon}>
                      <LockIcon />
                    </span>
                    <input
                      id="reg-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      className={styles.inputField}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.trailingBtn}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <label className={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    className={styles.hiddenCheckbox}
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span className={`${styles.customCheckbox} ${acceptTerms ? styles.customCheckboxChecked : ""}`}>
                    {acceptTerms && <CheckIcon />}
                  </span>
                  <span className={styles.checkboxLabel}>
                    I agree to Sangam&apos;s{" "}
                    <a href="#terms" className={styles.termsLink} onClick={(e) => e.preventDefault()}>
                      Terms
                    </a>{" "}
                    and{" "}
                    <a href="#privacy" className={styles.termsLink} onClick={(e) => e.preventDefault()}>
                      Privacy Policy
                    </a>
                  </span>
                </label>

                <button
                  type="submit"
                  className={styles.primarySubmitBtn}
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? "Creating Account..." : "Create Account"}</span>
                  <ArrowRightIcon />
                </button>

                <div className={styles.divider} />

                <div className={styles.cardFooter}>
                  Already have an account?
                  <span
                    className={styles.footerActionLink}
                    onClick={() => handleModeSwitch(0)}
                    role="button"
                    tabIndex={0}
                  >
                    Sign In
                  </span>
                </div>
              </form>
            )}

            {/* MODE 0: SIGN IN */}
            {mode === 0 && (
              <form onSubmit={onSubmitLogin} noValidate>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel} htmlFor="login-email">
                    Email Address
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.leadingIcon}>
                      <MailIcon />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      className={styles.inputField}
                      placeholder="you@college.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel} htmlFor="login-password">
                    Password
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.leadingIcon}>
                      <LockIcon />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      className={styles.inputField}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.trailingBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className={styles.rememberRow}>
                  <label className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      className={styles.hiddenCheckbox}
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className={`${styles.customCheckbox} ${rememberMe ? styles.customCheckboxChecked : ""}`}>
                      {rememberMe && <CheckIcon />}
                    </span>
                    <span className={styles.checkboxLabel}>Keep me signed in</span>
                  </label>
                  <button
                    type="button"
                    className={styles.forgotBtn}
                    onClick={() => {
                      clearMessages();
                      setSuccess("If this email exists, password reset instructions have been sent.");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className={styles.primarySubmitBtn}
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? "Signing In..." : "Sign In"}</span>
                  <ArrowRightIcon />
                </button>

                <div className={styles.divider} />

                <div className={styles.cardFooter}>
                  Don&apos;t have an account?
                  <span
                    className={styles.footerActionLink}
                    onClick={() => handleModeSwitch(1)}
                    role="button"
                    tabIndex={0}
                  >
                    Create Account
                  </span>
                </div>
              </form>
            )}

            {/* MODE 2: EMAIL VERIFICATION */}
            {mode === 2 && (
              <form onSubmit={onSubmitVerify}>
                {devOtp && (
                  <div className={styles.devOtpBanner}>
                    💡 Dev Code: <strong>{devOtp}</strong> (Sent to console & email)
                  </div>
                )}

                <div className={styles.otpGrid} onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpRefs[idx]}
                      type="text"
                      maxLength={1}
                      className={styles.otpInput}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className={styles.primarySubmitBtn}
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? "Verifying..." : "Verify & Continue"}</span>
                  <ArrowRightIcon />
                </button>

                <div className={styles.resendRow}>
                  <span>Didn&apos;t receive code?</span>
                  <button
                    type="button"
                    className={styles.resendBtn}
                    disabled={cooldown > 0}
                    onClick={onResendOtp}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                  </button>
                </div>

                <div className={styles.divider} />

                <div className={styles.cardFooter}>
                  <span
                    className={styles.footerActionLink}
                    onClick={() => handleModeSwitch(0)}
                    role="button"
                    tabIndex={0}
                  >
                    &larr; Back to Sign In
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
