import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import styles from "../styles/videoComponent.module.css";

const ROLE_LABELS = { host: "Host", cohost: "Co-host", speaker: "Speaker", attendee: "Audience" };

const roleBtnStyle = {
  padding: "0.15rem 0.35rem",
  fontSize: "0.7rem",
  background: "rgba(255, 255, 255, 0.1)",
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  cursor: "pointer",
};

export default function ParticipantsPanel({
  isOpen,
  onClose,
  participants = [],
  localParticipant = {},
  isHost = false,
  isLocked = false,
  waitingParticipants = [],
  raisedHands = new Set(),
  onAdmit = () => {},
  onDeny = () => {},
  onMuteAll = () => {},
  onToggleLock = () => {},
  onMuteParticipant = () => {},
  onRemoveParticipant = () => {},
  onTransferHost = () => {},
  onSetRole = () => {},
  canManageCohosts = isHost,
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

      {/* Host Quick Moderation Header Controls */}
      {isHost && (
        <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            type="button"
            onClick={onMuteAll}
            style={{
              flex: 1,
              padding: "0.35rem 0.5rem",
              fontSize: "0.78rem",
              background: "rgba(255, 92, 92, 0.15)",
              color: "var(--danger, #FF5C5C)",
              border: "1px solid rgba(255, 92, 92, 0.3)",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Mute All
          </button>
          <button
            type="button"
            onClick={onToggleLock}
            style={{
              flex: 1,
              padding: "0.35rem 0.5rem",
              fontSize: "0.78rem",
              background: isLocked ? "rgba(245, 196, 81, 0.15)" : "rgba(255, 255, 255, 0.08)",
              color: isLocked ? "var(--idle, #F5C451)" : "inherit",
              border: isLocked ? "1px solid rgba(245, 196, 81, 0.3)" : "1px solid rgba(255,255,255,0.12)",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {isLocked ? "Unlock Room" : "Lock Room"}
          </button>
        </div>
      )}

      {/* Waiting Room Section for Host */}
      {isHost && waitingParticipants.length > 0 && (
        <div style={{ padding: "0.5rem 0.75rem", background: "rgba(245, 196, 81, 0.08)", borderBottom: "1px solid rgba(245, 196, 81, 0.2)" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--idle, #F5C451)" }}>
            Waiting Room ({waitingParticipants.length})
          </span>
          {waitingParticipants.map((wp) => (
            <div key={wp.socketId || wp.identity} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.35rem" }}>
              <span style={{ fontSize: "0.82rem" }}>{wp.name || wp.identity}</span>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <button
                  type="button"
                  onClick={() => onAdmit(wp)}
                  style={{
                    padding: "0.2rem 0.45rem",
                    fontSize: "0.72rem",
                    background: "var(--speaking, #5FD39A)",
                    color: "#000",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Admit
                </button>
                <button
                  type="button"
                  onClick={() => onDeny(wp)}
                  style={{
                    padding: "0.2rem 0.45rem",
                    fontSize: "0.72rem",
                    background: "rgba(255, 92, 92, 0.2)",
                    color: "var(--danger, #FF5C5C)",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}


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
            {(raisedHands.has(localParticipant.socketId || "local") || localParticipant.handRaised) && (
              <span className={styles.iconIndicator} title="Hand raised" style={{ fontSize: 16 }}>
                ✋
              </span>
            )}
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
          const hasHandRaised =
            raisedHands.has(p.socketId) || raisedHands.has(p.identity) || Boolean(p.handRaised);

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
                  {p.role && p.role !== "speaker" ? `${ROLE_LABELS[p.role]} · ` : ""}
                  {p.connectionStatus || "Connected"}
                </span>
              </div>

              <div className={styles.participantIndicators}>
                {hasHandRaised && (
                  <span className={styles.iconIndicator} title="Hand raised" style={{ fontSize: 16 }}>
                    ✋
                  </span>
                )}
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
                {isHost && p.role !== "host" && (
                  <div style={{ display: "flex", gap: "0.25rem", marginLeft: "0.35rem" }}>
                    {p.role === "attendee" && (
                      <button
                        type="button"
                        title="Let this attendee use camera and microphone"
                        onClick={() => onSetRole(p.identity || p.socketId, "speaker")}
                        style={{
                          ...roleBtnStyle,
                          background: hasHandRaised ? "var(--accent, #FF7A59)" : roleBtnStyle.background,
                          color: hasHandRaised ? "#1A0E09" : roleBtnStyle.color,
                        }}
                      >
                        Allow to speak
                      </button>
                    )}
                    {p.role === "speaker" && (
                      <button
                        type="button"
                        title="Move to audience (listen only)"
                        onClick={() => onSetRole(p.identity || p.socketId, "attendee")}
                        style={roleBtnStyle}
                      >
                        Audience
                      </button>
                    )}
                    {canManageCohosts && (p.role === "speaker" || p.role === "cohost") && (
                      <button
                        type="button"
                        title={p.role === "cohost" ? "Remove co-host" : "Make co-host"}
                        onClick={() =>
                          onSetRole(p.identity || p.socketId, p.role === "cohost" ? "speaker" : "cohost")
                        }
                        style={roleBtnStyle}
                      >
                        {p.role === "cohost" ? "Uncohost" : "Co-host"}
                      </button>
                    )}
                    <button
                      type="button"
                      title="Mute participant"
                      onClick={() => onMuteParticipant(p.identity || p.socketId)}
                      style={{
                        padding: "0.15rem 0.35rem",
                        fontSize: "0.7rem",
                        background: "rgba(255, 92, 92, 0.2)",
                        color: "var(--danger, #FF5C5C)",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Mute
                    </button>
                    <button
                      type="button"
                      title="Remove from meeting"
                      onClick={() => onRemoveParticipant(p.identity || p.socketId)}
                      style={{
                        padding: "0.15rem 0.35rem",
                        fontSize: "0.7rem",
                        background: "rgba(255, 255, 255, 0.1)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Kick
                    </button>
                    {canManageCohosts && (
                    <button
                      type="button"
                      title="Transfer host role"
                      onClick={() => onTransferHost(p.identity || p.socketId)}
                      style={{
                        padding: "0.15rem 0.35rem",
                        fontSize: "0.7rem",
                        background: "rgba(95, 211, 154, 0.2)",
                        color: "var(--speaking, #5FD39A)",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Host
                    </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}


        {participants.length === 0 && (
          <div
            style={{
              padding: "1.75rem 1rem",
              textAlign: "center",
              color: "var(--text-muted, #716A5D)",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span style={{ fontWeight: 500, color: "var(--text-secondary, #A8A29E)" }}>
              No other participants yet
            </span>
            <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>
              Share the meeting link to invite others to this room.
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
