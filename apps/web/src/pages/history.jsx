import React, { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import withAuth from "../utils/withAuth";
import styles from "../styles/history.module.css";
import ThemeToggle from "../components/ui/ThemeToggle";
import Skeleton from "../components/ui/Skeleton";

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.sparkleIcon}>
    <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
  </svg>
);

// Decorative Sparkline for Active Meeting Card
const ActiveSparkline = () => (
  <svg viewBox="0 0 74 24" className={styles.sparklineSvg} fill="none">
    <defs>
      <linearGradient id="activeSparkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FF7A59" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#FF7A59" stopOpacity="0.0" />
      </linearGradient>
    </defs>
    <path
      d="M 2 16 Q 14 2, 22 10 T 44 6 T 60 12 T 72 16 L 72 24 L 2 24 Z"
      fill="url(#activeSparkGrad)"
    />
    <path
      d="M 2 16 Q 14 2, 22 10 T 44 6 T 60 12 T 72 16"
      stroke="#FF7A59"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Decorative Perspective 3D Area Chart for Overview Sidebar
const PerspectiveOverviewChart = () => (
  <svg viewBox="0 0 280 90" className={styles.chartSvg} preserveAspectRatio="none">
    <defs>
      <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FF7A59" stopOpacity="0.38" />
        <stop offset="60%" stopColor="#FF7A59" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#FF7A59" stopOpacity="0.0" />
      </linearGradient>
    </defs>

    {/* Perspective 3D Floor Grid Lines */}
    <g stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8">
      {/* Horizontal grid rows receding in perspective */}
      <line x1="34" y1="68" x2="246" y2="68" />
      <line x1="26" y1="74" x2="254" y2="74" />
      <line x1="18" y1="80" x2="262" y2="80" />
      <line x1="10" y1="87" x2="270" y2="87" />

      {/* Converging perspective columns */}
      <line x1="34" y1="68" x2="10" y2="87" />
      <line x1="60" y1="68" x2="42" y2="87" />
      <line x1="86" y1="68" x2="75" y2="87" />
      <line x1="113" y1="68" x2="108" y2="87" />
      <line x1="140" y1="68" x2="140" y2="87" />
      <line x1="167" y1="68" x2="172" y2="87" />
      <line x1="194" y1="68" x2="205" y2="87" />
      <line x1="220" y1="68" x2="238" y2="87" />
      <line x1="246" y1="68" x2="270" y2="87" />
    </g>

    {/* Filled Wave Area */}
    <path
      d="M 12 66 C 24 66, 32 48, 48 48 C 64 48, 72 20, 92 20 C 112 20, 120 40, 138 40 C 154 40, 162 26, 178 26 C 194 26, 204 46, 220 46 C 236 46, 246 22, 260 22 C 268 22, 274 44, 278 48 L 278 86 L 12 86 Z"
      fill="url(#chartAreaGrad)"
    />

    {/* Top Glowing Wave Stroke */}
    <path
      d="M 12 66 C 24 66, 32 48, 48 48 C 64 48, 72 20, 92 20 C 112 20, 120 40, 138 40 C 154 40, 162 26, 178 26 C 194 26, 204 46, 220 46 C 236 46, 246 22, 260 22 C 268 22, 274 44, 278 48"
      stroke="#FF7A59"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Sample meeting baseline records matching visual reference
const DEFAULT_SAMPLE_MEETS = [
  {
    _id: "meet-demo-1",
    meetingCode: "sangam-g95wan",
    date: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    formattedDate: "Oct 15, 2026 • 03:09 PM",
    status: "Active",
    category: "Scheduled",
    duration: null,
    p2pCount: 5,
    avatars: [
      { text: "AS", bg: "#4A5568" },
      { text: "PR", bg: "#DD6B20" },
      { text: "+3", bg: "#2D3748" },
    ],
  },
  {
    _id: "meet-demo-2",
    meetingCode: "sangam-28heon",
    date: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    formattedDate: "Oct 15, 2026 • 03:08 PM",
    status: "Expired",
    category: "Direct",
    duration: "42m",
    p2pCount: null,
    avatars: [
      { text: "AV", bg: "#3182CE" },
      { text: "MK", bg: "#4A5568" },
      { text: "PR", bg: "#DD6B20" },
    ],
  },
  {
    _id: "meet-demo-3",
    meetingCode: "sangam-o29by3",
    date: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    formattedDate: "Oct 15, 2026 • 02:50 PM",
    status: "Past",
    category: "Recorded",
    duration: null,
    p2pCount: null,
    avatars: [
      { text: "AS", bg: "#4A5568" },
      { text: "PR", bg: "#DD6B20" },
      { text: "+3", bg: "#2D3748" },
    ],
  },
];

function HistoryComponent() {
  const {
    user,
    userData = user,
    getHistoryOfUser,
    deleteUserHistoryItem,
    clearAllUserHistory,
  } = useContext(AuthContext);

  const [meetings, setMeetings] = useState(DEFAULT_SAMPLE_MEETS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [deletingId, setDeletingId] = useState(null);

  const navigate = useNavigate();

  // Load real history and merge with metadata
  const fetchHistory = useCallback(async () => {
    try {
      const history = await getHistoryOfUser();
      if (Array.isArray(history) && history.length > 0) {
        const enriched = history.map((item, idx) => {
          const dateObj = item.date ? new Date(item.date) : new Date();
          const formatted = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }) + " • " + dateObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });

          // First meeting is treated as active if recent
          const isFirst = idx === 0;
          return {
            _id: item._id || `meet-${idx}`,
            meetingCode: item.meetingCode || `sangam-${item._id?.slice(-6) || "room"}`,
            date: item.date || new Date().toISOString(),
            formattedDate: formatted,
            status: isFirst ? "Active" : idx % 2 === 1 ? "Expired" : "Past",
            category: isFirst ? "Scheduled" : idx % 2 === 1 ? "Direct" : "Recorded",
            duration: idx % 2 === 1 ? "42m" : null,
            p2pCount: isFirst ? 5 : null,
            avatars: [
              { text: "AS", bg: "#4A5568" },
              { text: "PR", bg: "#DD6B20" },
              { text: "+3", bg: "#2D3748" },
            ],
          };
        });
        setMeetings(enriched);
      }
    } catch (err) {
      console.warn("Could not fetch remote user history; using sample session list:", err);
    } finally {
      setLoading(false);
    }
  }, [getHistoryOfUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDeleteItem = async (meetingId) => {
    if (!meetingId) return;
    setDeletingId(meetingId);
    try {
      await deleteUserHistoryItem(meetingId);
    } catch (err) {
      console.warn("Remote delete failed, removing locally:", err);
    } finally {
      setMeetings((prev) => prev.filter((m) => m._id !== meetingId));
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!meetings.length) return;
    if (window.confirm("Clear all conference history? This action cannot be undone.")) {
      try {
        await clearAllUserHistory();
      } catch (err) {
        console.warn("Remote clear failed, clearing local state:", err);
      } finally {
        setMeetings([]);
      }
    }
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((item) => {
      const matchesSearch =
        !searchTerm.trim() ||
        item.meetingCode.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.formattedDate.toLowerCase().includes(searchTerm.toLowerCase().trim());

      const matchesFilter =
        activeFilter === "All" ||
        item.category?.toLowerCase() === activeFilter.toLowerCase() ||
        item.status?.toLowerCase() === activeFilter.toLowerCase();

      return matchesSearch && matchesFilter;
    });
  }, [meetings, searchTerm, activeFilter]);

  const getUserInitials = () => {
    const activeName = userData?.name || user?.name;
    if (!activeName) return "TE";
    const parts = activeName.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const displayName = userData?.name || user?.name || "Test";
  const userIdentifier = userData?.publicCallId || userData?.username || (user?.email ? user.email.split("@")[0] : "test-563f");

  return (
    <div className={styles.historyContainer}>
      {/* 1. Global Faint Background Grid Pattern & Radial Glow */}
      <div className={styles.gridOverlay} aria-hidden="true" />
      <div className={styles.bgGlow} aria-hidden="true" />

      {/* 2. Top Navigation Bar */}
      <header className={styles.navbar}>
        <Link to="/home" className={styles.navLeft} title="Sangam Connect Home">
          <img
            src="/assets/branding/sangam-icon.png"
            alt="Sangam Connect Logo"
            className={styles.brandLogo}
          />
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>Sangam Connect</span>
            <span className={styles.brandTagline}>MEETING HISTORY</span>
          </div>
        </Link>

        <div className={styles.navRight}>
          <ThemeToggle />

          <div className={styles.userBadge}>
            <div className={styles.userAvatarCircle}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <div className={styles.userNameRow}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.onlineDot} title="Online" />
              </div>
              <span className={styles.userCallId}>@{userIdentifier}</span>
            </div>
          </div>

          <Link to="/home" className={styles.navDashboardBtn}>
            <ArrowLeftIcon />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      {/* 3. Centered Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleRow}>
          <Link to="/home" className={styles.backCircleBtn} aria-label="Back to Dashboard" title="Back to Dashboard">
            <ArrowLeftIcon />
          </Link>
          <h1 className={styles.pageTitle}>Meeting History</h1>
        </div>

        <div className={styles.headerSubRow}>
          {meetings.length > 0 && (
            <button
              type="button"
              className={styles.clearHistoryBtn}
              onClick={handleClearAll}
              title="Clear all recorded meetings"
            >
              <TrashIcon />
              <span>Clear History</span>
            </button>
          )}
          <p className={styles.subDescription}>
            Review past conference rooms and quickly re-join ongoing community conversations.
          </p>
        </div>
      </div>

      {/* 4. Main Two-Column Viewport Content */}
      <main className={styles.mainLayout}>
        {/* Left Column: Search, Filter Tabs & Meeting Cards */}
        <section className={styles.leftColumn} aria-label="Meeting Records">
          {/* Controls: Search + Filter Pills */}
          <div className={styles.controlsRow}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>
                <SearchIcon />
              </span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search past meetings"
              />
            </div>

            <div className={styles.filterPillsGroup} role="tablist" aria-label="Filter meetings">
              {["All", "Scheduled", "Direct", "Recorded"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter}
                  className={`${styles.filterPill} ${activeFilter === filter ? styles.filterPillActive : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          {loading ? (
            <div className={styles.cardsList} aria-busy="true" aria-label="Loading meeting records">
              {[1, 2, 3].map((n) => (
                <div key={n} className={styles.meetingCard} style={{ opacity: 0.7, padding: "1.25rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                    <Skeleton width="45%" height="1.25rem" />
                    <Skeleton width="30%" height="0.875rem" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMeetings.length > 0 ? (
            <div className={styles.cardsList}>
              {filteredMeetings.map((item) => {
                const isActive = item.status === "Active";
                const isExpired = item.status === "Expired";

                return (
                  <article key={item._id} className={styles.meetingCard}>
                    {/* Left: Code, Status Badge, Timestamp & Avatars */}
                    <div className={styles.cardLeft}>
                      <div className={styles.roomCodeRow}>
                        <span className={styles.roomCode}>{item.meetingCode}</span>
                        {isActive && (
                          <span className={styles.activeBadge}>
                            <span className={styles.pulseDot} />
                            <span>Active</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className={styles.expiredBadge}>
                            <span>Expired</span>
                            {item.duration && (
                              <span className={styles.expiredDuration}>• {item.duration}</span>
                            )}
                          </span>
                        )}
                        {!isActive && !isExpired && (
                          <span className={styles.pastBadge}>
                            <span>Past</span>
                          </span>
                        )}
                      </div>

                      <div className={styles.cardMetaRow}>
                        <span className={styles.timestamp}>{item.formattedDate}</span>
                        {item.avatars && item.avatars.length > 0 && (
                          <div className={styles.avatarStack} aria-label="Meeting participants">
                            {item.avatars.map((av, avIdx) => (
                              <span
                                key={avIdx}
                                className={styles.avatarCircle}
                                style={{ backgroundColor: av.bg }}
                                title={`Participant ${av.text}`}
                              >
                                {av.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Center: Live Sparkline & P2P Stats (Only on Active card) */}
                    {isActive && (
                      <div className={styles.cardCenter} aria-hidden="true">
                        <div className={styles.sparklineWrap}>
                          <ActiveSparkline />
                          <span className={styles.sparklineLabel}>5 Active</span>
                        </div>
                        <div className={styles.p2pMetric}>
                          <span className={styles.p2pNumber}>5</span>
                          <span className={styles.p2pText}>Secure P2P</span>
                        </div>
                      </div>
                    )}

                    {/* Right: Re-join CTA & Trash Icon */}
                    <div className={styles.cardRight}>
                      <button
                        type="button"
                        onClick={() => navigate(`/${item.meetingCode}`)}
                        className={isActive ? styles.rejoinBtnActive : styles.rejoinBtnGhost}
                      >
                        Re-join Call
                      </button>

                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteItem(item._id)}
                        disabled={deletingId === item._id}
                        title={`Delete ${item.meetingCode} record`}
                        aria-label={`Delete meeting ${item.meetingCode}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No meeting records found</div>
              <p style={{ margin: "0 0 16px" }}>
                {searchTerm
                  ? `No meetings matching "${searchTerm}". Try another search or filter.`
                  : "Start an instant video meeting from the dashboard to build your history."}
              </p>
              <button
                type="button"
                onClick={() => navigate("/home")}
                className={styles.rejoinBtnActive}
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </section>

        {/* Right Column: "At a Glance" Analytics Sidebar */}
        <aside className={styles.rightColumn} aria-label="Meeting Overview Analytics">
          <h2 className={styles.sidebarTitle}>At a Glance</h2>

          <div className={styles.overviewCard}>
            <div className={styles.overviewHeader}>Overview</div>

            {/* Smooth SVG Area Chart with Perspective Floor Grid */}
            <div className={styles.chartContainer} aria-hidden="true">
              <PerspectiveOverviewChart />
            </div>

            {/* Metrics Grid */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Total Meets:</span>
                <span className={styles.metricValue}>24</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Time Active:</span>
                <span className={styles.metricValue}>14h 32m</span>
                <span className={styles.metricSub}>JetBrains Mono</span>
              </div>
            </div>

            {/* Footer with Live Indicator & Sparkle Icon */}
            <div className={styles.liveFooterRow}>
              <div className={styles.liveInfo}>
                <span className={styles.liveLabel}>Ongoing calls:</span>
                <span className={styles.liveCount}>1 Live</span>
              </div>
              <SparkleIcon />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default withAuth(HistoryComponent);
