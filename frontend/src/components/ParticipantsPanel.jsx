import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import styles from "../styles/videoComponent.module.css";

export default function ParticipantsPanel({
  isOpen,
  onClose,
  participants = [],
  localParticipant = {},
}) {
  if (!isOpen) return null;

  const totalCount = 1 + participants.length;

  const getInitials = (name) => {
    if (!name) return "SC";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const renderBadge = (isGuest) => {
    return isGuest ? (
      <span className={styles.guestBadge}>Guest</span>
    ) : (
      <span className={styles.memberBadge}>Member</span>
    );
  };

  const renderConnectionDot = (status) => {
    let color = "var(--speaking, #5FD39A)";
    if (status === "connecting" || status === "reconnecting") color = "var(--idle, #F5C451)";
    if (status === "failed") color = "var(--danger, #FF5C5C)";

    return (
      <span
        className={styles.connStatusDot}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        title={`Connection: ${status || "connected"}`}
      />
    );
  };

  return (
    <aside className={styles.sidePanelContainer} aria-label="Meeting Participants">
      <div className={styles.sidePanelHeader}>
        <div className={styles.panelTitleGroup}>
          <h2 className={styles.chatHeaderTitle}>Participants</h2>
          <span className={styles.participantCountPill}>{totalCount}</span>
        </div>
        <button
          type="button"
          className={styles.closeChatBtn}
          onClick={onClose}
          title="Close participants panel"
        >
          <CloseIcon fontSize="small" />
        </button>
      </div>

      <div className={styles.participantsList}>
        {/* Local Participant (You) */}
        <div className={`${styles.participantRow} ${styles.localParticipantRow}`}>
          <div className={styles.participantAvatarWrapper}>
            <div className={styles.participantAvatar}>
              {getInitials(localParticipant.username || "You")}
            </div>
            {renderConnectionDot(localParticipant.connectionStatus || "connected")}
          </div>

          <div className={styles.participantDetails}>
            <div className={styles.participantNameRow}>
              <span className={styles.participantName}>
                {localParticipant.username || "You"} <strong className={styles.youTag}>(You)</strong>
              </span>
              {renderBadge(localParticipant.isGuest)}
            </div>
            <span className={styles.participantRoleSubtitle}>
              {localParticipant.connectionStatus || "Connected"}
            </span>
          </div>

          <div className={styles.participantIndicators}>
            {localParticipant.screenSharing && (
              <span className={styles.iconIndicator} title="Sharing screen">
                <ScreenShareIcon style={{ fontSize: 16, color: "var(--accent, #FF7A59)" }} />
              </span>
            )}
            <span
              className={styles.iconIndicator}
              title={localParticipant.camera ? "Camera active" : "Camera off"}
            >
              {localParticipant.camera ? (
                <VideocamIcon style={{ fontSize: 16, color: "var(--speaking, #5FD39A)" }} />
              ) : (
                <VideocamOffIcon style={{ fontSize: 16, color: "var(--text-muted, #716A5D)" }} />
              )}
            </span>
            <span
              className={styles.iconIndicator}
              title={localParticipant.mic ? "Microphone active" : "Microphone muted"}
            >
              {localParticipant.mic ? (
                <MicIcon style={{ fontSize: 16, color: "var(--speaking, #5FD39A)" }} />
              ) : (
                <MicOffIcon style={{ fontSize: 16, color: "var(--danger, #FF5C5C)" }} />
              )}
            </span>
          </div>
        </div>

        {/* Remote Participants */}
        {participants.map((p) => {
          const micActive = p.mediaState?.mic ?? true;
          const cameraActive = p.mediaState?.camera ?? true;
          const screenActive = p.mediaState?.screenSharing ?? false;
          const isSpeaking = p.mediaState?.isSpeaking ?? false;

          return (
            <div
              key={p.socketId}
              className={`${styles.participantRow} ${isSpeaking ? styles.speakingRowGlow : ""}`}
            >
              <div className={styles.participantAvatarWrapper}>
                <div
                  className={`${styles.participantAvatar} ${
                    isSpeaking ? styles.avatarSpeakingRing : ""
                  }`}
                >
                  {getInitials(p.username || "Participant")}
                </div>
                {renderConnectionDot(p.connectionStatus || "connected")}
              </div>

              <div className={styles.participantDetails}>
                <div className={styles.participantNameRow}>
                  <span className={styles.participantName}>
                    {p.username || `Participant (${p.socketId.slice(0, 5)})`}
                  </span>
                  {renderBadge(p.isGuest)}
                </div>
                <span className={styles.participantRoleSubtitle}>
                  {p.connectionStatus || "Connected"}
                </span>
              </div>

              <div className={styles.participantIndicators}>
                {screenActive && (
                  <span className={styles.iconIndicator} title="Sharing screen">
                    <ScreenShareIcon style={{ fontSize: 16, color: "var(--accent, #FF7A59)" }} />
                  </span>
                )}
                <span
                  className={styles.iconIndicator}
                  title={cameraActive ? "Camera active" : "Camera off"}
                >
                  {cameraActive ? (
                    <VideocamIcon style={{ fontSize: 16, color: "var(--speaking, #5FD39A)" }} />
                  ) : (
                    <VideocamOffIcon style={{ fontSize: 16, color: "var(--text-muted, #716A5D)" }} />
                  )}
                </span>
                <span
                  className={styles.iconIndicator}
                  title={micActive ? "Microphone active" : "Microphone muted"}
                >
                  {micActive ? (
                    <MicIcon style={{ fontSize: 16, color: "var(--speaking, #5FD39A)" }} />
                  ) : (
                    <MicOffIcon style={{ fontSize: 16, color: "var(--danger, #FF5C5C)" }} />
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
