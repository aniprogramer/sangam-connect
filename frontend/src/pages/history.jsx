import React, { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import withAuth from "../utils/withAuth";
import styles from "../styles/home.module.css";
import { RadialGlowButton } from "../components/ui";
import ThemeToggle from "../components/ui/ThemeToggle";

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function HistoryComponent() {
  const {
    user,
    userData = user,
    getHistoryOfUser,
    deleteUserHistoryItem,
    clearAllUserHistory,
  } = useContext(AuthContext);

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  const fetchHistory = useCallback(async () => {
    try {
      const history = await getHistoryOfUser();
      if (Array.isArray(history)) {
        setMeetings(history);
      }
    } catch (err) {
      console.error("Failed to load user meeting history:", err);
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
      setMeetings((prev) => prev.filter((m) => m._id !== meetingId));
    } catch (err) {
      console.error("Failed to delete history item:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!meetings.length) return;
    if (window.confirm("Are you sure you want to clear your entire meeting history? This action cannot be undone.")) {
      try {
        await clearAllUserHistory();
        setMeetings([]);
      } catch (err) {
        console.error("Failed to clear history:", err);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserInitials = () => {
    const activeName = userData?.name || user?.name;
    if (!activeName) return "SC";
    const parts = activeName.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const displayName = userData?.name || user?.name || "Member";
  const userIdentifier = userData?.publicCallId || userData?.email || user?.email || "sangam.user";

  return (
    <div className={styles.homeContainer}>
      {/* Background Atmosphere */}
      <div className={styles.bgAtmosphere} aria-hidden="true">
        <div className={styles.glowOrbCoral} />
        <div className={styles.glowOrbAmber} />
        <div className={styles.gridPattern} />
      </div>

      {/* Navbar */}
      <header className={styles.navbar}>
        <Link to="/home" className={styles.navLeft}>
          <img
            src="/assets/branding/sangam-icon.png"
            alt="Sangam Connect Icon"
            className={styles.brandLogo}
          />
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>Sangam Connect</span>
            <span className={styles.brandTagline}>Meeting History</span>
          </div>
        </Link>

        <div className={styles.navRight}>
          <ThemeToggle />
          <div className={styles.userBadge}>
            <div className={styles.userAvatarCircle}>{getUserInitials()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userCallId}>@{userIdentifier}</span>
            </div>
          </div>

          <Link to="/home" className={styles.navBtn}>
            <ArrowLeftIcon />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className={styles.sectionHeaderRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Link to="/home" className={styles.navBtn} style={{ padding: "8px 12px" }}>
                <ArrowLeftIcon />
              </Link>
              <h1 className={styles.welcomeHeading} style={{ fontSize: "28px", margin: 0 }}>
                Meeting History
              </h1>
            </div>

            {meetings.length > 0 && (
              <button
                type="button"
                className={styles.clearAllBtn}
                onClick={handleClearAll}
              >
                <TrashIcon />
                <span>Clear All History</span>
              </button>
            )}
          </div>

          <p className={styles.subHeading} style={{ marginBottom: "32px" }}>
            Review past conference rooms and quickly re-join ongoing community conversations.
          </p>

          {loading ? (
            <div className={styles.emptyState}>Loading your meeting history...</div>
          ) : meetings.length > 0 ? (
            <div className={styles.historyGrid}>
              {meetings.map((item, idx) => (
                <div key={item._id || idx} className={styles.historyCard}>
                  <div className={styles.historyCardHeader}>
                    <span className={styles.historyCode}>{item.meetingCode}</span>
                    <button
                      type="button"
                      className={styles.deleteItemBtn}
                      onClick={() => handleDeleteItem(item._id)}
                      disabled={deletingId === item._id}
                      title="Delete meeting record"
                      aria-label={`Delete meeting ${item.meetingCode}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className={styles.historyDate}>{formatDate(item.date)}</div>
                  <RadialGlowButton
                    onClick={() => navigate(`/${item.meetingCode}`)}
                    variant="secondary"
                    style={{ width: "100%", padding: "8px 14px", fontSize: "13px" }}
                  >
                    Re-join Call
                  </RadialGlowButton>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
                No meeting records found
              </div>
              <p style={{ margin: "0 0 20px" }}>
                Start a call or join an existing meeting from the dashboard to build your history.
              </p>
              <RadialGlowButton to="/home" variant="primary">
                Back to Dashboard
              </RadialGlowButton>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default withAuth(HistoryComponent);
