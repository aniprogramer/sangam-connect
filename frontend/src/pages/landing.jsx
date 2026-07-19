import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "../styles/landing.module.css";

const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 6.5a4 4 0 0 0 8 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="7" y1="11" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const CamIcon = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
    <rect x="0.5" y="0.5" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M11 5l4-3v10l-4-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EndIcon = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
    <path d="M1 5c2-3 6-4 10-4s8 1 10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M8 9l-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="3" r="1.2" fill="currentColor" />
    <circle cx="7" cy="7" r="1.2" fill="currentColor" />
    <circle cx="7" cy="11" r="1.2" fill="currentColor" />
  </svg>
);

const ScreenIcon = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
    <rect x="3.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 11v1.5h6V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const participants = [
  { initials: "PS", name: "Priya Sharma", color: "#FF9839" },
  { initials: "AV", name: "Arjun Verma", color: "#5DD39E" },
  { initials: "MK", name: "Meera Kapoor", color: "#4F8EF7" },
  { initials: "VR", name: "Vikram Rao", color: "#E8637A" },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 40);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.bgGradient} />

      <div className={styles.bridgeCurves}>
        <svg viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
          <path d="M-100,420 C200,320 400,620 700,470 C1000,320 1200,520 1500,420" stroke="rgba(255,152,57,0.05)" strokeWidth="1.5" />
          <path d="M-100,530 C300,430 500,730 800,580 C1100,430 1300,630 1600,530" stroke="rgba(79,142,247,0.04)" strokeWidth="1" />
        </svg>
      </div>

      <div className={styles.connectedDots}>
        <svg viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
          <circle cx="200" cy="300" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="420" cy="240" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="350" cy="460" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="620" cy="340" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="540" cy="560" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="820" cy="390" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="920" cy="610" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="1120" cy="330" r="1.5" fill="rgba(255,255,255,0.07)" />
          <circle cx="1300" cy="480" r="1.5" fill="rgba(255,255,255,0.07)" />
          <line x1="200" y1="300" x2="420" y2="240" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="420" y1="240" x2="620" y2="340" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="620" y1="340" x2="820" y2="390" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="820" y1="390" x2="1120" y2="330" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="350" y1="460" x2="540" y2="560" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="540" y1="560" x2="920" y2="610" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1="1120" y1="330" x2="1300" y2="480" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </svg>
      </div>

      <div className={styles.bgGlowOrange} />
      <div className={styles.bgGlowBlue} />

      <div className={styles.geometricMesh} />

      <div className={styles.particles}>
        <div className={styles.particle} style={{ top: "18%", left: "22%", animationDelay: "0s", animationDuration: "9s" }} />
        <div className={styles.particle} style={{ top: "45%", left: "65%", animationDelay: "2.4s", animationDuration: "11s" }} />
        <div className={styles.particle} style={{ top: "72%", left: "15%", animationDelay: "4.1s", animationDuration: "8s" }} />
        <div className={styles.particle} style={{ top: "28%", left: "75%", animationDelay: "1.3s", animationDuration: "13s" }} />
        <div className={styles.particle} style={{ top: "58%", left: "42%", animationDelay: "3.7s", animationDuration: "10s" }} />
        <div className={styles.particle} style={{ top: "82%", left: "80%", animationDelay: "5.2s", animationDuration: "12s" }} />
        <div className={styles.particle} style={{ top: "35%", left: "88%", animationDelay: "0.8s", animationDuration: "7s" }} />
      </div>

      <nav className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ""}`}>
        <div className={styles.navLeft}>
          <div className={styles.logoMark}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="8" cy="14" r="5" fill="#FF9839" />
              <circle cx="20" cy="14" r="5" fill="#FF9839" />
              <line x1="13" y1="14" x2="15" y2="14" stroke="#FF9839" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.logoTextGroup}>
            <span className={styles.logoTitle}>Antar Setu</span>
            <span className={styles.logoTagline}>Bridging Distances.</span>
          </div>
        </div>
        <div className={styles.navRight}>
          <a href="#guest" className={`${styles.navLink} ${styles.navLinkShow}`}>Join as Guest</a>
          <a href="#login" className={`${styles.navLink} ${styles.navLinkShow}`}>Login</a>
          <Link to="/auth" className={styles.navCta}>Get Started</Link>
        </div>
      </nav>

      <main className={`${styles.hero} ${heroVisible ? styles.heroVisible : ""}`}>
        <div className={styles.heroLeft}>
          <div className={styles.badge}>Secure Browser Meetings</div>

          <h1 className={styles.heading}>
            <span className={styles.accent}>Connect</span> beyond distances.
          </h1>

          <p className={styles.description}>
            Bridging people through secure, high-quality video meetings.
          </p>

          <div className={styles.ctaRow}>
            <Link to="/auth" className={styles.ctaPrimary}>
              Get Started
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <button className={styles.ctaSecondary}>Join Meeting</button>
          </div>

          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>50K+</span>
              <span className={styles.statLabel}>Meetings Hosted</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statValue}>99.9%</span>
              <span className={styles.statLabel}>Uptime</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statValue}>HD</span>
              <span className={styles.statLabel}>Video Quality</span>
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.laptopWrapper}>
            <div className={styles.laptop}>
              <div className={styles.laptopLid} />
              <div className={styles.laptopScreen}>
                <div className={styles.screenCamera} />
                <div className={styles.meetingGrid}>
                  {participants.map((p, i) => (
                    <div
                      key={i}
                      className={`${styles.participantTile} ${i === 1 ? styles.activeSpeaker : ""}`}
                      style={{ "--tile-color": p.color }}
                    >
                      <div className={styles.participantAvatar} style={{ background: p.color }}>
                        {p.initials}
                      </div>
                      <div className={styles.participantName}>{p.name}</div>
                      {i === 1 && <div className={styles.speakerIndicator} />}
                    </div>
                  ))}
                </div>
                <div className={styles.controlsBar}>
                  <button className={styles.controlBtn}><MicIcon /></button>
                  <button className={styles.controlBtn}><CamIcon /></button>
                  <button className={`${styles.controlBtn} ${styles.controlEnd}`}><EndIcon /></button>
                  <button className={styles.controlBtn}><ScreenIcon /></button>
                  <button className={styles.controlBtn}><MoreIcon /></button>
                </div>
                <div className={styles.meetingTimer}>12:34</div>
              </div>
            </div>
          </div>

          <div className={styles.phoneWrapper}>
            <div className={styles.phone}>
              <div className={styles.phoneTop}>
                <div className={styles.phoneSpeaker} />
              </div>
              <div className={styles.phoneScreen}>
                <div className={styles.phoneParticipant} style={{ "--phone-tile": "#5DD39E" }}>
                  <div className={styles.phoneAvatar}>AV</div>
                  <div className={styles.phoneLabel}>Arjun Verma</div>
                </div>
                <div className={styles.phoneControls}>
                  <span className={styles.phoneCtl}><MicIcon /></span>
                  <span className={styles.phoneCtl}><CamIcon /></span>
                  <span className={`${styles.phoneCtl} ${styles.phoneCtlEnd}`}><EndIcon /></span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.notificationCard}>
            <div className={styles.notifAvatar} style={{ background: "#5DD39E" }}>AV</div>
            <div className={styles.notifContent}>
              <span className={styles.notifName}>Arjun Verma</span>
              <span className={styles.notifAction}>joined the meeting</span>
            </div>
          </div>

          <div className={styles.chatCard}>
            <div className={styles.chatHeader}>
              <span className={styles.chatSender}>Meera Kapoor</span>
            </div>
            <div className={styles.chatBubble}>
              Let&apos;s review the quarterly designs.
            </div>
          </div>

          <div className={styles.participantCard}>
            <div className={styles.pcAvatar} style={{ background: "#E8637A" }}>VR</div>
            <div className={styles.pcInfo}>
              <span className={styles.pcName}>Vikram Rao</span>
              <span className={styles.pcStatus}>Presenting</span>
            </div>
            <div className={styles.pcLiveDot} />
          </div>

          <div className={styles.recordingBadge}>
            <span className={styles.recDot} />
            <span>REC</span>
          </div>

          <div className={styles.captionBadge}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="0.5" y="1.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="0.8" />
              <line x1="2.5" y1="5" x2="5.5" y2="5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="2.5" y1="7" x2="4" y2="7" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="7" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="6.5" y1="7" x2="9.5" y2="7" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
            </svg>
            Live Captions
          </div>
        </div>
      </main>
    </div>
  );
}
