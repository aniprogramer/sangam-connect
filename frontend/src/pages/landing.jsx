import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "../styles/landing.module.css";
import SangamSculpture3D from "../components/SangamSculpture3D";
import ThemeToggle from "../components/ui/ThemeToggle";

// SVG Icons
const VideoCameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const MicOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const ScreenShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" />
    <path d="m8 21 3-3 3 3" />
    <path d="M12 18v3" />
    <path d="m17 8 5-5" />
    <path d="M17 3h5v5" />
  </svg>
);

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ClockHistoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const SignalBarsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h.01" />
    <path d="M7 20v-4" />
    <path d="M12 20v-8" />
    <path d="M17 20V8" />
    <path d="M22 20V4" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const EndCallIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.12-8.68A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
    <line x1="23" y1="1" x2="1" y2="23" />
  </svg>
);

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="6" y2="6" />
    <line x1="6" x2="6.01" y1="18" y2="18" />
  </svg>
);

export default function LandingPage() {
  const [meetingCode, setMeetingCode] = useState("");
  const [activeTab, setActiveTab] = useState("chat"); // "chat" or "participants"
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [previewMessages, setPreviewMessages] = useState([
    { sender: "Aniket S.", time: "10:24 AM", text: "Welcome everyone!" },
    { sender: "Priya R.", time: "10:25 AM", text: "Let's get started with the agenda." },
    { sender: "Rohan K.", time: "10:26 AM", text: "Sounds good! 🚀" },
    { sender: "Meera K.", time: "10:26 AM", text: "I'll share the notes after this call." },
  ]);
  const [newMsgText, setNewMsgText] = useState("");
  const [selectedNode, setSelectedNode] = useState("p2p"); // "signaling", "p2p", "relay"

  const navigate = useNavigate();

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    const code = meetingCode.trim();
    if (code) {
      navigate(`/${code}`);
    }
  };

  const handleSendPreviewMsg = (e) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;
    setPreviewMessages((prev) => [
      ...prev,
      { sender: "You", time: "Just now", text: newMsgText.trim() },
    ]);
    setNewMsgText("");
  };

  return (
    <div className={styles.page}>
      {/* Background Lighting & Atmosphere */}
      <div className={styles.bgAtmosphere} aria-hidden="true">
        <div className={styles.glowOrbTopCenter} />
        <div className={styles.glowOrbMidRight} />
        <div className={styles.glowOrbArchitecture} />
        <div className={styles.gridPattern} />
      </div>

      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navbarContent}>
          <Link to="/" className={styles.navBrand} title="Sangam Connect">
            <img
              src="/assets/branding/sangam-logo.png"
              alt="Sangam Connect"
              className={styles.navLogo}
            />
            <div className={styles.navBrandText}>
              <span className={styles.navTitle}>Sangam Connect</span>
              <span className={styles.navTagline}>Where Voices Converge</span>
            </div>
          </Link>

          {/* Centered Frosted Pill Menu */}
          <nav className={styles.navPillMenu} aria-label="Main Navigation">
            <a href="#features" className={styles.navPillLink}>Features</a>
            <a href="#architecture" className={styles.navPillLink}>Architecture</a>
            <a href="#security" className={styles.navPillLink}>Security</a>
          </nav>

          {/* Right Action Links */}
          <div className={styles.navActions}>
            <ThemeToggle />
            <Link to="/login" className={styles.navSignInLink}>Sign In</Link>
            <Link to="/register" className={styles.navGetStartedBtn}>
              <span>Get Started</span>
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Hero Section ── */}
      <section className={styles.heroSection}>
        {/* Left Column: Headline, Copy & Actions */}
        <div className={styles.heroLeft}>
          <div className={styles.eyebrowPill}>
            <span className={styles.eyebrowDot} />
            <span>VIDEO &bull; VOICE &bull; COMMUNITY</span>
          </div>

          <h1 className={styles.heroHeadline}>
            Where voices
            <span className={styles.heroAccent}>find their people.</span>
          </h1>

          <p className={styles.heroSubtext}>
            Clear, low-latency video calls, meaningful conversations and community spaces &mdash; all in one place.
          </p>

          {/* Action Row */}
          <div className={styles.heroCtaRow}>
            <Link to="/register" className={styles.primaryCtaBtn}>
              <span>Start connecting</span>
              <ArrowRightIcon />
            </Link>
            <a href="#preview" className={styles.secondaryCtaBtn}>
              <span>Explore the platform</span>
              <span style={{ fontSize: "16px" }}>&rsaquo;</span>
            </a>
          </div>

          {/* Integrated Room Code Join Box */}
          <form onSubmit={handleJoinMeeting} className={styles.heroJoinForm}>
            <input
              type="text"
              placeholder="Enter meeting code (e.g. sangam-123)"
              className={styles.heroJoinInput}
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
            />
            <button
              type="submit"
              className={styles.heroJoinBtn}
              disabled={!meetingCode.trim()}
            >
              Join
            </button>
          </form>

          {/* Bottom Social Proof / Participants Row */}
          <div className={styles.bottomProofRow}>
            <img
              src="/assets/avatars_stack_transparent.png"
              alt="Community participants"
              className={styles.proofAvatarsImg}
            />
            <div className={styles.proofTextGroup}>
              <div className={styles.proofLine1}>PEOPLE &bull; IDEAS &bull; CONVERSATIONS</div>
              <div className={styles.proofLine2}>ALL IN ONE PLACE</div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D Connection Sculpture & Overlays */}
        <div className={styles.heroRight}>
          {/* Real 3D Connection Sculpture */}
          <SangamSculpture3D />

          {/* Overlay 1: Live Status Badge */}
          <div className={styles.statusPill}>
            <span className={styles.liveDot} />
            <span>Connected - 24 ms</span>
          </div>

          {/* Overlay 2: Audio Waveform Capsule */}
          <div className={styles.audioWavePill} aria-hidden="true">
            <span className={styles.waveBar} style={{ animationDelay: "0ms" }} />
            <span className={styles.waveBar} style={{ animationDelay: "200ms" }} />
            <span className={styles.waveBar} style={{ animationDelay: "400ms" }} />
            <span className={styles.waveBar} style={{ animationDelay: "150ms" }} />
            <span className={styles.waveBar} style={{ animationDelay: "300ms" }} />
          </div>

          {/* Overlay 3: Floating Participant Priya R. */}
          <div className={styles.floatingCardPriya}>
            <img
              src="/assets/priya_hero.jpg"
              alt="Priya R."
              className={styles.floatingCardImg}
            />
            <div className={styles.floatingCardLabel}>
              <MicIcon />
              <span>Priya R.</span>
            </div>
          </div>

          {/* Overlay 4: Floating Participant Aniket S. */}
          <div className={styles.floatingCardAniket}>
            <img
              src="/assets/aniket_hero.jpg"
              alt="Aniket S."
              className={styles.floatingCardImg}
            />
            <div className={styles.floatingCardLabel}>
              <MicIcon />
              <span>Aniket S.</span>
            </div>
          </div>

          {/* Overlay 5: Reaction Badge */}
          <div className={styles.reactionBadge}>
            <img
              src="/assets/peer_a.jpg"
              alt=""
              className={styles.reactionAvatar}
            />
            <span>Great discussion today! 👏</span>
          </div>
        </div>
      </section>

      {/* ── Interactive Meeting Preview ── */}
      <section id="preview" className={styles.previewSection}>
        <div className={styles.meetingWindow}>
          {/* Header Bar */}
          <div className={styles.windowHeader}>
            <div className={styles.windowBrandLeft}>
              <img
                src="/assets/branding/sangam-icon.png"
                alt=""
                className={styles.windowLogoIcon}
              />
              <div className={styles.roomCodeBadge}>
                <span>🔒</span>
                <span>sangam-community-call</span>
              </div>
            </div>

            <div className={styles.windowHeaderRight}>
              <div className={styles.headerMetric}>
                <span>04:28</span>
              </div>
              <div className={styles.headerMetric}>
                <UsersIcon />
                <span>4</span>
              </div>
            </div>
          </div>

          {/* Main Stage */}
          <div className={styles.windowMain}>
            {/* Left Sidebar Icon Strip */}
            <div className={styles.meetingSidebar}>
              <button
                type="button"
                className={`${styles.sidebarIconBtn} ${styles.sidebarIconActive}`}
                title="Video Conference"
              >
                <VideoCameraIcon />
              </button>
              <button
                type="button"
                className={styles.sidebarIconBtn}
                onClick={() => setActiveTab("chat")}
                title="In-Call Chat"
              >
                <ChatIcon />
              </button>
              <button
                type="button"
                className={styles.sidebarIconBtn}
                onClick={() => setActiveTab("participants")}
                title="Participants"
              >
                <UsersIcon />
              </button>
              <button
                type="button"
                className={styles.sidebarIconBtn}
                title="Settings"
              >
                <SettingsIcon />
              </button>
            </div>

            {/* Video Stage 2x2 Grid */}
            <div className={styles.conferenceStage}>
              <div className={styles.videoGrid}>
                {/* Tile 1: Aniket S. */}
                <div className={`${styles.videoTile} ${styles.videoTileActive}`}>
                  {isCameraOff ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8F877B" }}>
                      Camera Off
                    </div>
                  ) : (
                    <img
                      src="/assets/aniket_meeting.jpg"
                      alt="Aniket S."
                      className={styles.tileImg}
                    />
                  )}
                  <div className={styles.tileNameBadge}>
                    <MicIcon />
                    <span>Aniket S. (Speaking)</span>
                  </div>
                </div>

                {/* Tile 2: Priya R. */}
                <div className={styles.videoTile}>
                  <img
                    src="/assets/priya_meeting.jpg"
                    alt="Priya R."
                    className={styles.tileImg}
                  />
                  <div className={styles.tileNameBadge}>
                    <span style={{ color: "#10B981" }}><MicIcon /></span>
                    <span>Priya R.</span>
                  </div>
                </div>

                {/* Tile 3: Rohan K. */}
                <div className={styles.videoTile}>
                  <img
                    src="/assets/rohan_meeting.jpg"
                    alt="Rohan K."
                    className={styles.tileImg}
                  />
                  <div className={styles.tileNameBadge}>
                    <MicIcon />
                    <span>Rohan K.</span>
                  </div>
                </div>

                {/* Tile 4: Meera K. */}
                <div className={styles.videoTile}>
                  <img
                    src="/assets/meera_meeting.jpg"
                    alt="Meera K."
                    className={styles.tileImg}
                  />
                  <div className={styles.tileNameBadge}>
                    <MicIcon />
                    <span>Meera K.</span>
                  </div>
                </div>
              </div>

              {/* In-Call Controls Pill */}
              <div className={styles.inCallControlsPill}>
                <button
                  type="button"
                  className={`${styles.controlCircleBtn} ${isMicMuted ? styles.controlCircleBtnOff : ""}`}
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  title={isMicMuted ? "Unmute Preview Mic" : "Mute Preview Mic"}
                >
                  {isMicMuted ? <MicOffIcon /> : <MicIcon />}
                </button>

                <button
                  type="button"
                  className={`${styles.controlCircleBtn} ${isCameraOff ? styles.controlCircleBtnOff : ""}`}
                  onClick={() => setIsCameraOff(!isCameraOff)}
                  title={isCameraOff ? "Turn On Preview Camera" : "Turn Off Preview Camera"}
                >
                  {isCameraOff ? <VideoCameraOffIcon /> : <VideoCameraIcon />}
                </button>

                <button
                  type="button"
                  className={styles.controlCircleBtn}
                  title="Share Screen"
                >
                  <ScreenShareIcon />
                </button>

                <button
                  type="button"
                  className={styles.controlCircleBtn}
                  title="More Options"
                >
                  <span>&bull;&bull;&bull;</span>
                </button>

                <Link
                  to="/register"
                  className={styles.endCallCircleBtn}
                  title="Leave Demo Call"
                >
                  <EndCallIcon />
                </Link>
              </div>
            </div>

            {/* Right Chat & Participants Drawer */}
            <div className={styles.chatDrawer}>
              <div className={styles.drawerTabs}>
                <button
                  type="button"
                  className={`${styles.drawerTabBtn} ${activeTab === "chat" ? styles.drawerTabActive : ""}`}
                  onClick={() => setActiveTab("chat")}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className={`${styles.drawerTabBtn} ${activeTab === "participants" ? styles.drawerTabActive : ""}`}
                  onClick={() => setActiveTab("participants")}
                >
                  Participants (4)
                </button>
              </div>

              {activeTab === "chat" ? (
                <>
                  <div className={styles.chatMessagesContainer}>
                    {previewMessages.map((msg, idx) => (
                      <div key={idx} className={styles.chatMessageItem}>
                        <div className={styles.chatMsgHeader}>
                          <span className={styles.chatMsgSender}>{msg.sender}</span>
                          <span className={styles.chatMsgTime}>{msg.time}</span>
                        </div>
                        <div className={styles.chatMsgBody}>{msg.text}</div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendPreviewMsg} className={styles.chatInputBox}>
                    <input
                      type="text"
                      className={styles.chatInputField}
                      placeholder="Type a message..."
                      value={newMsgText}
                      onChange={(e) => setNewMsgText(e.target.value)}
                    />
                    <button type="submit" className={styles.chatSendBtn} title="Send">
                      <SendIcon />
                    </button>
                  </form>
                </>
              ) : (
                <div className={styles.chatMessagesContainer}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                    <span>Aniket S. (Host)</span>
                    <span style={{ color: "#FF7A59" }}><MicIcon /></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                    <span>Priya R.</span>
                    <span style={{ color: "#10B981" }}><MicIcon /></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                    <span>Rohan K.</span>
                    <span style={{ color: "#FF7A59" }}><MicIcon /></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                    <span>Meera K.</span>
                    <span style={{ color: "#FF7A59" }}><MicIcon /></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Capabilities Section ── */}
      <section id="features" className={styles.capabilitiesSection}>
        <div className={styles.sectionCategory}>Product Capabilities</div>
        <h2 className={styles.sectionHeadline}>The conversation stays in flow.</h2>
        <p className={styles.sectionSubtitle}>
          Everything you need for real communication &mdash; simple, powerful, and built for people.
        </p>

        <div className={styles.capabilitiesGrid}>
          {/* Card 1: Peer-to-Peer Video */}
          <div className={styles.capabilityCard}>
            <div>
              <div className={styles.capabilityIconBox}>
                <VideoCameraIcon />
              </div>
              <h3 className={styles.capabilityTitle}>Peer-to-Peer Video</h3>
              <p className={styles.capabilityDesc}>
                High-definition video with optimized WebRTC connections for clear calls even on lower bandwidth.
              </p>
            </div>
            <Link to="/register" className={styles.capabilityArrowBtn} title="Learn more">
              <ArrowRightIcon />
            </Link>
          </div>

          {/* Card 2: Community Spaces */}
          <div className={styles.capabilityCard}>
            <div>
              <div className={styles.capabilityIconBox}>
                <UsersIcon />
              </div>
              <h3 className={styles.capabilityTitle}>Community Spaces</h3>
              <p className={styles.capabilityDesc}>
                Create channels, bring teams and friends together, and keep the conversation going.
              </p>
            </div>
            <Link to="/register" className={styles.capabilityArrowBtn} title="Explore communities">
              <ArrowRightIcon />
            </Link>
          </div>

          {/* Card 3: Meeting History */}
          <div className={styles.capabilityCard}>
            <div>
              <div className={styles.capabilityIconBox}>
                <ClockHistoryIcon />
              </div>
              <h3 className={styles.capabilityTitle}>Meeting History</h3>
              <p className={styles.capabilityDesc}>
                Easily find and rejoin past rooms and continue conversations from your dashboard.
              </p>
            </div>
            <Link to="/history" className={styles.capabilityArrowBtn} title="View history">
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Architecture Section ── */}
      <section id="architecture" className={styles.architectureSection}>
        <div className={styles.sectionCategory}>Architecture</div>
        <div className={styles.architectureContent}>
          {/* Left Text */}
          <div className={styles.archLeft}>
            <h2 className={styles.sectionHeadline} style={{ textAlign: "left" }}>
              Fast by design.
              <span className={styles.heroAccent}>Calm by nature.</span>
            </h2>
            <p className={styles.heroSubtext} style={{ textAlign: "left" }}>
              Sangam Connect uses modern WebRTC signaling to connect peers directly for high-quality, low-latency communication, with adaptive fallbacks for reliable performance.
            </p>

            <div className={styles.archFeatureList}>
              <div className={styles.archFeatureItem}>
                <div className={styles.archFeatureIcon}>
                  <LightningIcon />
                </div>
                <div>
                  <div className={styles.archFeatureTitle}>Optimized peer-to-peer connections</div>
                  <div className={styles.archFeatureDesc}>Direct media paths with minimal latency</div>
                </div>
              </div>

              <div className={styles.archFeatureItem}>
                <div className={styles.archFeatureIcon}>
                  <SignalBarsIcon />
                </div>
                <div>
                  <div className={styles.archFeatureTitle}>Adaptive to real-world networks</div>
                  <div className={styles.archFeatureDesc}>Intelligent fallbacks when needed</div>
                </div>
              </div>

              <div className={styles.archFeatureItem}>
                <div className={styles.archFeatureIcon}>
                  <ShieldCheckIcon />
                </div>
                <div>
                  <div className={styles.archFeatureTitle}>Engineered for stability</div>
                  <div className={styles.archFeatureDesc}>Smooth and reliable conversations</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Architecture Diagram */}
          <div className={styles.diagramCard}>
            {/* Signaling Server Node */}
            <div
              className={styles.serverNode}
              onClick={() => setSelectedNode("signaling")}
              title="Click to inspect signaling role"
            >
              <ServerIcon />
              <span>Signaling Server (Socket.IO)</span>
            </div>

            {/* SVG Connecting curves */}
            <svg className={styles.svgConnections} viewBox="0 0 340 60" fill="none">
              <path
                d="M 170 0 C 170 30, 60 10, 60 60"
                stroke="#FF7A59"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.65"
              />
              <path
                d="M 170 0 C 170 30, 280 10, 280 60"
                stroke="#FF7A59"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.65"
              />
            </svg>

            {/* Peer Nodes & Direct WebRTC Link */}
            <div className={styles.peersRow}>
              {/* Peer A */}
              <div
                className={styles.peerCard}
                onClick={() => setSelectedNode("p2p")}
                title="Peer A"
              >
                <img
                  src="/assets/peer_a.jpg"
                  alt="You"
                  className={styles.peerCardImg}
                />
                <div className={styles.peerMeta}>
                  <span>You (Peer A)</span>
                  <VideoCameraIcon />
                </div>
              </div>

              {/* Direct WebRTC Link */}
              <div
                className={styles.directConnectionMiddle}
                onClick={() => setSelectedNode("p2p")}
                title="Direct WebRTC Link"
              >
                <div className={styles.directLineBadge}>
                  Direct peer connection (WebRTC)
                </div>
                <div className={styles.bidirectionalArrow} />
                <div
                  className={styles.relayLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode("relay");
                  }}
                >
                  Relay (if needed)
                </div>
              </div>

              {/* Peer B */}
              <div
                className={styles.peerCard}
                onClick={() => setSelectedNode("p2p")}
                title="Peer B"
              >
                <img
                  src="/assets/peer_b.jpg"
                  alt="Peer B"
                  className={styles.peerCardImg}
                />
                <div className={styles.peerMeta}>
                  <span>Peer B</span>
                  <VideoCameraIcon />
                </div>
              </div>
            </div>

            {/* Dynamic Inspector Box */}
            <div className={styles.diagramInspectorBox}>
              {selectedNode === "signaling" && (
                <span>
                  <strong>Signaling Server:</strong> Facilitates lightweight SDP offer/answer exchange and ICE candidate discovery via secure WebSocket without proxying private media tracks.
                </span>
              )}
              {selectedNode === "p2p" && (
                <span>
                  <strong>Direct WebRTC:</strong> Video & audio flow directly between browsers using encrypted SRTP/DTLS with sub-50ms peer latency.
                </span>
              )}
              {selectedNode === "relay" && (
                <span>
                  <strong>Relay Fallback:</strong> Automatically selected if symmetric NAT or corporate firewall prevents direct STUN traversal.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Value Pillars Section ── */}
      <section id="security" className={styles.pillarsSection}>
        <div className={styles.pillarsGrid}>
          <div className={styles.pillarCard}>
            <div className={styles.pillarIconBox}>
              <UsersIcon />
            </div>
            <div className={styles.pillarTextBox}>
              <div className={styles.pillarTitle}>People First</div>
              <p className={styles.pillarDesc}>Tools that make conversations more human and meaningful.</p>
            </div>
          </div>

          <div className={styles.pillarCard}>
            <div className={styles.pillarIconBox}>
              <ShieldCheckIcon />
            </div>
            <div className={styles.pillarTextBox}>
              <div className={styles.pillarTitle}>Private by Design</div>
              <p className={styles.pillarDesc}>Your meetings, your data, your control.</p>
            </div>
          </div>

          <div className={styles.pillarCard}>
            <div className={styles.pillarIconBox}>
              <LightningIcon />
            </div>
            <div className={styles.pillarTextBox}>
              <div className={styles.pillarTitle}>Built for What&apos;s Next</div>
              <p className={styles.pillarDesc}>A platform that grows with your community.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Refined Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrandCol}>
              <img
                src="/assets/branding/sangam-logo.png"
                alt="Sangam Connect"
                className={styles.footerLogo}
              />
              <p className={styles.footerBrandDesc}>
                A modern video conferencing and community platform for people, teams, and ideas to come together.
              </p>
            </div>

            <div className={styles.footerLinksList}>
              <div className={styles.footerColTitle}>Product</div>
              <a href="#features" className={styles.footerLink}>Features</a>
              <a href="#architecture" className={styles.footerLink}>Architecture</a>
              <a href="#security" className={styles.footerLink}>Security</a>
            </div>

            <div className={styles.footerLinksList}>
              <div className={styles.footerColTitle}>Platform</div>
              <Link to="/home" className={styles.footerLink}>Dashboard</Link>
              <Link to="/history" className={styles.footerLink}>Meeting History</Link>
              <Link to="/register" className={styles.footerLink}>Create Account</Link>
            </div>

            <div className={styles.footerLinksList}>
              <div className={styles.footerColTitle}>Company</div>
              <a href="#terms" className={styles.footerLink} onClick={(e) => e.preventDefault()}>Terms of Service</a>
              <a href="#privacy" className={styles.footerLink} onClick={(e) => e.preventDefault()}>Privacy Policy</a>
              <a href="#contact" className={styles.footerLink} onClick={(e) => e.preventDefault()}>Contact</a>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>&copy; {new Date().getFullYear()} Sangam Connect. All rights reserved.</span>
            <div className={styles.footerSocials}>
              <span>Where Voices Converge</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
