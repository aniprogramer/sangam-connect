import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import styles from "../styles/home.module.css";
import SangamSculpture3D from "../components/SangamSculpture3D";
import ThemeToggle from "../components/ui/ThemeToggle";
import NetworkStatusBadge from "../components/NetworkStatusBadge";

// SVG Icons
const VideoCameraIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 8-6 4 6 4V8Z" />
    <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
  </svg>
);

const VideoCameraOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
    <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
  </svg>
);

const LinkIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const LightningIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="12" x2="12" y2="22" />
  </svg>
);

const MicOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" y1="12" x2="12" y2="22" />
  </svg>
);

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const WaveformIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10v4" />
    <path d="M6 7v10" />
    <path d="M10 4v16" />
    <path d="M14 6v12" />
    <path d="M18 9v6" />
    <path d="M22 11v2" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SignalBarsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h.01" />
    <path d="M7 20v-4" />
    <path d="M12 20v-8" />
    <path d="M17 20V8" />
    <path d="M22 20V4" />
  </svg>
);

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Media preview states
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState("Media Devices Ready");
  const [showSettingsAlert, setShowSettingsAlert] = useState(false);
  const videoPreviewRef = useRef(null);

  const {
    user,
    userData = user,
    handleLogout,
    addToUserHistory,
    getHistoryOfUser,
    deleteUserHistoryItem,
  } = useContext(AuthContext);

  const fetchHistory = useCallback(async () => {
    try {
      const history = await getHistoryOfUser();
      if (Array.isArray(history)) {
        setRecentMeetings(history.slice(0, 4));
      }
    } catch (err) {
      console.warn("Could not load user history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [getHistoryOfUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  const toggleCamera = async () => {
    if (isCamOn) {
      if (mediaStream) {
        mediaStream.getVideoTracks().forEach((t) => t.stop());
      }
      setIsCamOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: isMicOn,
        });
        setMediaStream(stream);
        setIsCamOn(true);
        setDeviceStatus("Media Devices Ready");
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Camera device error:", err);
        setDeviceStatus("Camera Unavailable");
      }
    }
  };

  const toggleMic = () => {
    setIsMicOn((prev) => {
      const next = !prev;
      if (mediaStream) {
        mediaStream.getAudioTracks().forEach((t) => (t.enabled = next));
      }
      return next;
    });
  };

  const handleDeleteItem = async (meetingId) => {
    if (!meetingId) return;
    try {
      await deleteUserHistoryItem(meetingId);
      setRecentMeetings((prev) => prev.filter((m) => m._id !== meetingId));
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  const handleJoinVideoCall = async (codeToJoin) => {
    let targetCode = (codeToJoin || meetingCode).trim();
    if (!targetCode) return;

    // Handle full URL pasted (e.g. http://localhost:3001/sangam-123 -> sangam-123)
    if (targetCode.includes("/")) {
      const parts = targetCode.split("/");
      targetCode = parts[parts.length - 1] || targetCode;
    }

    try {
      await addToUserHistory(targetCode);
    } catch (e) {
      console.warn("Could not save to history:", e);
    }
    navigate(`/${targetCode}`);
  };

  const handleCreateInstantMeeting = async () => {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const newCode = `sangam-${randomSuffix}`;
    await handleJoinVideoCall(newCode);
  };

  const displayName = userData?.name || user?.name || "Test";
  const userHandle =
    userData?.handle ||
    userData?.publicCallId ||
    (userData?.email
      ? `@${userData.email.split("@")[0]}`
      : `@${displayName.toLowerCase().replace(/\s+/g, "")}-${(userData?._id || "563f").slice(-4)}`);

  const getUserInitials = () => {
    if (!displayName) return "TE";
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.homeContainer}>
      {/* Background Lighting & Grid */}
      <div className={styles.bgAtmosphere} aria-hidden="true">
        <div className={styles.glowOrbTopCenter} />
        <div className={styles.glowOrbRight} />
        <div className={styles.glowOrbBottomLeft} />
        <div className={styles.gridPattern} />
      </div>

      {/* Top Navigation Bar */}
      <header className={styles.navbar}>
        <Link to="/home" className={styles.navLeft} title="Sangam Connect Home">
          <img
            src="/assets/branding/sangam-logo.png"
            alt="Sangam Connect"
            className={styles.brandLogo}
          />
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>Sangam Connect</span>
            <span className={styles.brandTagline}>WHERE VOICES CONVERGE</span>
          </div>
        </Link>

        <div className={styles.navRight}>
          <NetworkStatusBadge />
          <ThemeToggle />

          {/* User Profile Chip */}
          <div className={styles.userBadge}>
            <div className={styles.userAvatarCircle}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userCallId}>{userHandle}</span>
            </div>
          </div>

          {/* History Button */}
          <Link to="/history" className={styles.navBtn}>
            <ClockIcon />
            <span>History</span>
          </Link>

          {/* Sign Out Button */}
          <button
            type="button"
            className={`${styles.navBtn} ${styles.logoutBtn}`}
            onClick={async () => {
              await handleLogout();
              navigate("/login");
            }}
          >
            <LogoutIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className={styles.mainContent}>
        <div className={styles.dashboardGrid}>
          {/* ── Left Column: Welcome & Action Cards ── */}
          <div className={styles.leftPanel}>
            <div className={styles.eyebrowText}>GOOD TO SEE YOU AGAIN,</div>
            <h1 className={styles.welcomeHeading}>
              Welcome back, <span className={styles.accentName}>{displayName}</span>
            </h1>
            <p className={styles.subHeading}>
              Where Voices Converge. Start an instant peer-to-peer video conference or join an ongoing conversation.
            </p>

            <div className={styles.actionStack}>
              {/* Card 1: New Video Call */}
              <div className={styles.actionCard}>
                <div className={styles.cardHeaderRow}>
                  <div className={styles.cardHeaderLeft}>
                    <div className={styles.cardIconBox}>
                      <VideoCameraIcon />
                    </div>
                    <h2 className={styles.cardTitle}>New Video Call</h2>
                  </div>
                  <div className={styles.instantBadge}>
                    <LightningIcon />
                    <span>Instant &bull; No Setup</span>
                  </div>
                </div>

                <p className={styles.cardDesc}>
                  Create a secure, instant conference room and share the link with participants.
                </p>

                <button
                  type="button"
                  className={styles.primaryActionBtn}
                  onClick={handleCreateInstantMeeting}
                >
                  <VideoCameraIcon />
                  <span>Create Instant Meeting</span>
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Card 2: Join with Code or Link */}
              <div className={styles.actionCard}>
                <div className={styles.cardHeaderRow}>
                  <div className={styles.cardHeaderLeft}>
                    <div className={styles.cardIconBox}>
                      <LinkIcon />
                    </div>
                    <h2 className={styles.cardTitle}>Join with Code or Link</h2>
                  </div>
                  <ArrowRightIcon />
                </div>

                <p className={styles.cardDesc}>
                  Enter a room code (e.g. sangam-abc123) to jump directly into the conversation.
                </p>

                <div className={styles.joinRow}>
                  <div className={styles.joinInputWrapper}>
                    <span className={styles.hashIcon}>#</span>
                    <input
                      type="text"
                      className={styles.joinInput}
                      placeholder="Enter meeting code..."
                      value={meetingCode}
                      onChange={(e) => setMeetingCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoinVideoCall();
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className={styles.joinSubmitBtn}
                    onClick={() => handleJoinVideoCall()}
                    disabled={!meetingCode.trim()}
                  >
                    <span>Join Call</span>
                    <ArrowRightIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: 3D Centerpiece + Floating Badges + Media Preview ── */}
          <div className={styles.rightPanel}>
            {/* Reflective Pedestal Base */}
            <div className={styles.pedestalBase} aria-hidden="true" />

            {/* Signature 3D Ribbon Loop Sculpture in Background */}
            <div className={styles.sculptureBackground} aria-hidden="true">
              <SangamSculpture3D />
            </div>

            {/* Floating Info Pills on Right of Sculpture */}
            <div className={styles.floatingBadgesCol}>
              <div className={styles.floatingPill}>
                <span className={styles.floatingPillIcon}>
                  <UsersIcon />
                </span>
                <div className={styles.floatingPillText}>
                  <span className={styles.floatingPillTitle}>Real Conversations</span>
                  <span className={styles.floatingPillSubtitle}>Real People</span>
                </div>
              </div>

              <div className={styles.floatingPill}>
                <span className={styles.floatingPillIcon}>
                  <WaveformIcon />
                </span>
                <div className={styles.floatingPillText}>
                  <span className={styles.floatingPillTitle}>Low Latency</span>
                  <span className={styles.floatingPillSubtitle}>High Quality</span>
                </div>
              </div>

              <div className={styles.floatingPill}>
                <span className={styles.floatingPillIcon}>
                  <ShieldIcon />
                </span>
                <div className={styles.floatingPillText}>
                  <span className={styles.floatingPillTitle}>Secure &amp; Private</span>
                </div>
              </div>
            </div>

            {/* Media Preview Monitor Card (Foreground) */}
            <div className={styles.mediaPreviewMonitor}>
              <div className={styles.monitorHeader}>
                <div className={styles.readyBadge}>
                  <span className={styles.readyDot} />
                  <span>{deviceStatus}</span>
                </div>
                <div className={styles.latencyBadge}>
                  <SignalBarsIcon />
                  <span>24 ms</span>
                </div>
              </div>

              <div className={styles.monitorBody}>
                {isCamOn ? (
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className={styles.previewVideoElement}
                  />
                ) : (
                  <>
                    <div className={styles.monitorAvatarCircle}>{getUserInitials()}</div>
                    <div className={styles.monitorUserName}>{displayName}</div>
                    <div className={styles.monitorUserHandle}>{userHandle}</div>
                  </>
                )}
              </div>

              <div className={styles.monitorControlsRow}>
                <button
                  type="button"
                  className={`${styles.monitorControlBtn} ${!isMicOn ? styles.monitorControlBtnOff : ""}`}
                  onClick={toggleMic}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <MicIcon /> : <MicOffIcon />}
                </button>

                <button
                  type="button"
                  className={`${styles.monitorControlBtn} ${isCamOn ? styles.monitorControlBtnOff : ""}`}
                  onClick={toggleCamera}
                  title={isCamOn ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {isCamOn ? <VideoCameraIcon /> : <VideoCameraOffIcon />}
                </button>

                <button
                  type="button"
                  className={styles.monitorControlBtn}
                  onClick={() => setShowSettingsAlert((prev) => !prev)}
                  title="Device Settings"
                >
                  <GearIcon />
                </button>
              </div>

              {showSettingsAlert && (
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  Active Audio: {isMicOn ? "Default Mic" : "Muted"} &bull; Video: {isCamOn ? "Camera Active" : "Camera Standby"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Recent Meetings Section ── */}
        <section className={styles.recentSection}>
          <div className={styles.recentHeaderRow}>
            <div className={styles.recentTitleGroup}>
              <div className={styles.recentTitleWithIcon}>
                <ClockIcon />
                <span>Recent Meetings</span>
              </div>
              <p className={styles.recentSubtext}>
                Your past meetings are securely saved. Rejoin or continue the conversation anytime.
              </p>
            </div>

            <Link to="/history" className={styles.viewAllLink}>
              <span>View Full History</span>
              <ArrowRightIcon />
            </Link>
          </div>

          <div className={styles.recentContainer}>
            {loadingHistory ? (
              <div className={styles.emptyState}>Loading meeting history...</div>
            ) : recentMeetings.length > 0 ? (
              <div className={styles.recentGrid}>
                {recentMeetings.map((item, idx) => (
                  <div key={item._id || idx} className={styles.historyCard}>
                    <div className={styles.historyCardHeader}>
                      <span className={styles.historyCode}>{item.meetingCode}</span>
                      <button
                        type="button"
                        className={styles.deleteItemBtn}
                        onClick={() => handleDeleteItem(item._id)}
                        title="Delete meeting record"
                        aria-label={`Delete meeting ${item.meetingCode}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className={styles.historyDate}>{formatDate(item.date)}</div>
                    <button
                      type="button"
                      className={styles.rejoinBtn}
                      onClick={() => handleJoinVideoCall(item.meetingCode)}
                    >
                      Re-join Call
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconBox}>
                  <VideoCameraIcon />
                </div>
                <div className={styles.emptyTitle}>No past meeting history yet.</div>
                <div className={styles.emptySubtitle}>
                  Create your first instant meeting above and start connecting!
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default withAuth(HomeComponent);
