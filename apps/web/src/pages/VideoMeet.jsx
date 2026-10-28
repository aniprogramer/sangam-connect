/**
 * VideoMeet.jsx — Sangam Connect Production Video Conferencing Component
 * Powered by LiveKit SFU (@livekit/components-react) & Socket.IO Signaling/Chat
 *
 * Architecture:
 * - LiveKit SFU handles all real-time media tracks (Camera, Screen, Audio).
 * - Socket.IO manages Room lifecycle, chat persistence & history replay, reactions.
 * - Dark Theme permanently enforced in Video Conferencing view.
 * - Presentation mode: Screen in Stage + Presenter PiP + Bottom Participant Strip.
 * - Gallery mode: 1x1, 2x1, 2x2, 3x2, and balanced grid layout with speaking rings & avatars.
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSocket, disconnectSocket } from "../lib/socket";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import InsertEmoticonIcon from "@mui/icons-material/InsertEmoticon";
import TimerOffIcon from "@mui/icons-material/TimerOff";
import ClosedCaptionIcon from "@mui/icons-material/ClosedCaption";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import PanToolIcon from "@mui/icons-material/PanTool";
import PictureInPictureAltIcon from "@mui/icons-material/PictureInPictureAlt";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import LockIcon from "@mui/icons-material/Lock";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

import styles from "../styles/videoComponent.module.css";
import SERVER_URL from "../environment";
import { AuthContext } from "../contexts/AuthContext";
import DeviceSettingsModal from "../components/DeviceSettingsModal";
import ParticipantsPanel from "../components/ParticipantsPanel";
import EmojiPicker from "../components/EmojiPicker";
import {
  extractRoomCode,
  copyToClipboard,
  safeCloseAudioContext,
  parseEmojiShortcodes,
  resolvePersonalRoomCode,
} from "@sangam/shared";
import NetworkStatusBadge from "../components/NetworkStatusBadge";


// ── Web Audio Chime Synthesizer ───────────────────────────────────────────────
const playChatChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);

    setTimeout(() => {
      safeCloseAudioContext(ctx);
    }, 250);
  } catch (_) {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDuration = (totalSeconds) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const getUserInitials = (name) => {
  if (!name) return "SC";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

/**
 * LiveKitMeetingStage — The in-call meeting view inside LiveKitRoom context
 */
function LiveKitMeetingStage({
  cleanRoomCode,
  username,
  isGuest,
  socketRef,
  onLeave,
  userData,
  isHost: initialIsHost = false,
  isLocked: initialIsLocked = false,
  isRecording: initialIsRecording = false,
}) {
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [isHost, setIsHost] = useState(initialIsHost);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [isRecording, setIsRecording] = useState(initialIsRecording);
  const [waitingParticipants, setWaitingParticipants] = useState([]);
  const [viewMode, setViewMode] = useState(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem("sangam_view_mode") || "gallery"
      : "gallery"
  );
  const [gridPage, setGridPage] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState(new Set());
  const [showCaptions, setShowCaptions] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [breakoutBanner, setBreakoutBanner] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [chatToast, setChatToast] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);

  const chatBottomRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const activeCameraIdRef = useRef(localStorage.getItem("sangam_camera_id") || "");
  const activeMicIdRef = useRef(localStorage.getItem("sangam_mic_id") || "");

  // Meeting elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch persisted chat history on mount
  useEffect(() => {
    let isCancelled = false;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/messages`);
        if (res.ok) {
          const history = await res.json();
          if (!isCancelled && Array.isArray(history)) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newItems = history
                .filter((h) => !existingIds.has(h._id))
                .map((h) => ({
                  id: h._id,
                  data: h.text,
                  sender: h.senderName,
                  socketId: h.senderId,
                  fileUrl: h.fileUrl || null,
                  fileName: h.fileName || null,
                  fileType: h.fileType || null,
                }));
              return [...newItems, ...prev];
            });
          }
        }
      } catch (_) {}
    };
    fetchHistory();
    return () => {
      isCancelled = true;
    };
  }, [cleanRoomCode]);

  // Socket.IO event listeners for chat, reactions, moderation, waiting room, hand-raise, captions
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleChatMessage = (data, sender, senderSocketId, msgId) => {
      const stableId = msgId || `${Date.now()}-${Math.random()}`;
      setMessages((prev) => {
        if (prev.some((m) => m.id === stableId)) return prev;
        const isObj = typeof data === "object" && data !== null;
        return [
          ...prev,
          {
            id: stableId,
            data: isObj ? data.data : data,
            sender,
            socketId: senderSocketId,
            fileUrl: isObj ? data.fileUrl : null,
            fileName: isObj ? data.fileName : null,
            fileType: isObj ? data.fileType : null,
          },
        ];
      });

      const isSelf = sender === username || senderSocketId === socket.id;
      if (!isSelf && !showChat) {
        setNewMessages((n) => n + 1);
        playChatChime();
        setChatToast({ id: stableId, data: typeof data === "object" ? data?.data : data, sender });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setChatToast(null), 4000);
      }
    };

    const handleReaction = (payload) => {
      const reactId = `${Date.now()}-${Math.random()}`;
      setFloatingReactions((prev) => [...prev, { ...payload, reactId }]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.reactId !== reactId));
      }, 3000);
    };

    const handleWaitingRequest = (req) => {
      setWaitingParticipants((prev) => {
        if (prev.some((p) => p.socketId === req.socketId || p.identity === req.identity)) return prev;
        return [...prev, req];
      });
    };

    const handleHandRaise = (payload) => {
      setRaisedHands((prev) => {
        const next = new Set(prev);
        if (payload.raised) {
          next.add(payload.socketId);
          if (payload.identity) next.add(payload.identity);
        } else {
          next.delete(payload.socketId);
          if (payload.identity) next.delete(payload.identity);
        }
        return next;
      });
    };

    const handleTranscription = (chunk) => {
      setCaptions((prev) => [
        ...prev.slice(-2),
        { text: chunk.text, speaker: chunk.speaker, timestamp: Date.now() },
      ]);
    };

    const handleModeration = (data) => {
      if (data.action === "mute-all") {
        if (localParticipant) localParticipant.setMicrophoneEnabled(false);
      } else if (data.action === "mute-individual") {
        if (data.targetIdentity === localParticipant?.identity || data.targetIdentity === socket.id) {
          localParticipant?.setMicrophoneEnabled(false);
        }
      } else if (data.action === "remove-participant") {
        if (data.targetIdentity === localParticipant?.identity || data.targetIdentity === socket.id) {
          alert("You were removed from the meeting by the host.");
          onLeave();
        }
      } else if (data.action === "lock-room") {
        setIsLocked(true);
      } else if (data.action === "unlock-room") {
        setIsLocked(false);
      } else if (data.action === "transfer-host") {
        if (data.targetIdentity === localParticipant?.identity || data.targetIdentity === socket.id) {
          setIsHost(true);
        }
      }
    };

    const handleRecordingStatus = (data) => {
      setIsRecording(Boolean(data.isRecording));
    };

    const handleBreakout = (data) => {
      if (data.action === "created") {
        const myRoom = data.breakoutRooms?.find(
          (r) =>
            r.participants?.includes(localParticipant?.identity) ||
            r.participants?.includes(username)
        );
        if (myRoom) setBreakoutBanner({ roomName: myRoom.name, roomId: myRoom.id });
      } else if (data.action === "closed") {
        setBreakoutBanner(null);
      }
    };

    socket.on("chat-message", handleChatMessage);
    socket.on("reaction", handleReaction);
    socket.on("waiting-room-request", handleWaitingRequest);
    socket.on("hand-raise", handleHandRaise);
    socket.on("transcription-chunk", handleTranscription);
    socket.on("room-moderation", handleModeration);
    socket.on("recording-status", handleRecordingStatus);
    socket.on("breakout-broadcast", handleBreakout);

    return () => {
      socket.off("chat-message", handleChatMessage);
      socket.off("reaction", handleReaction);
      socket.off("waiting-room-request", handleWaitingRequest);
      socket.off("hand-raise", handleHandRaise);
      socket.off("transcription-chunk", handleTranscription);
      socket.off("room-moderation", handleModeration);
      socket.off("recording-status", handleRecordingStatus);
      socket.off("breakout-broadcast", handleBreakout);
    };
  }, [socketRef, username, showChat, localParticipant, onLeave]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (showChat && chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
  }, [messages, showChat]);

  // Copy room code
  const copyRoomCode = useCallback(async () => {
    const success = await copyToClipboard(cleanRoomCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [cleanRoomCode]);

  // Send chat message
  const handleSendMessage = () => {
    if (!message.trim()) return;
    const parsedText = parseEmojiShortcodes(message.trim());
    const stableId = `${Date.now()}-${socketRef.current?.id || "local"}-${Math.random().toString(36).slice(2, 7)}`;

    setMessages((prev) => [
      ...prev,
      { id: stableId, data: parsedText, sender: username, socketId: socketRef.current?.id },
    ]);

    if (socketRef.current?.connected) {
      socketRef.current.emit("chat-message", parsedText, username, stableId);
    }
    setMessage("");
  };

  // Toggle handlers for side panels
  const toggleChat = useCallback(() => {
    setShowChat((prev) => {
      if (!prev) setShowParticipants(false);
      return !prev;
    });
    setNewMessages(0);
    setChatToast(null);
  }, []);

  const toggleParticipants = useCallback(() => {
    setShowParticipants((prev) => {
      if (!prev) setShowChat(false);
      return !prev;
    });
  }, []);

  // Media toggles via LiveKit local participant
  const toggleCamera = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
    }
  }, [localParticipant]);

  const toggleMic = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
    }
  }, [localParticipant]);

  const toggleScreenShare = useCallback(async () => {
    if (localParticipant) {
      try {
        await localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled);
      } catch (err) {
        console.error("Screen share toggle error:", err);
      }
    }
  }, [localParticipant]);

  // Device selection from settings modal
  const handleSelectCamera = useCallback(
    async (deviceId) => {
      activeCameraIdRef.current = deviceId;
      localStorage.setItem("sangam_camera_id", deviceId);
      if (room?.switchActiveDevice) {
        try {
          await room.switchActiveDevice("videoinput", deviceId);
        } catch (_) {}
      }
    },
    [room]
  );

  const handleSelectMic = useCallback(
    async (deviceId) => {
      activeMicIdRef.current = deviceId;
      localStorage.setItem("sangam_mic_id", deviceId);
      if (room?.switchActiveDevice) {
        try {
          await room.switchActiveDevice("audioinput", deviceId);
        } catch (_) {}
      }
    },
    [room]
  );

  const handleToggleHandRaise = useCallback(() => {
    setIsHandRaised((prev) => {
      const next = !prev;
      if (socketRef.current) {
        socketRef.current.emit("hand-raise", {
          raised: next,
          roomId: cleanRoomCode,
        });
      }
      setRaisedHands((rPrev) => {
        const nextSet = new Set(rPrev);
        if (next) nextSet.add("local");
        else nextSet.delete("local");
        return nextSet;
      });
      return next;
    });
  }, [cleanRoomCode, socketRef]);

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "gallery" ? "speaker" : "gallery";
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("sangam_view_mode", next);
      }
      return next;
    });
  }, []);

  const handleToggleRecording = useCallback(async () => {
    const nextRec = !isRecording;
    setIsRecording(nextRec);
    const endpoint = nextRec ? "start" : "stop";
    try {
      await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/recording/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerIdentity: username }),
      });
      if (socketRef.current) {
        socketRef.current.emit("recording-status", { isRecording: nextRec });
      }
    } catch (_) {}
  }, [cleanRoomCode, isRecording, socketRef, username]);

  const handleMuteAll = useCallback(async () => {
    try {
      await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mute-all" }),
      });
      if (socketRef.current) {
        socketRef.current.emit("room-moderation", { action: "mute-all", roomId: cleanRoomCode });
      }
    } catch (_) {}
  }, [cleanRoomCode, socketRef]);

  const handleToggleLock = useCallback(async () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    try {
      await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextLocked ? "lock-room" : "unlock-room" }),
      });
      if (socketRef.current) {
        socketRef.current.emit("room-moderation", {
          action: nextLocked ? "lock-room" : "unlock-room",
          roomId: cleanRoomCode,
        });
      }
    } catch (_) {}
  }, [cleanRoomCode, isLocked, socketRef]);

  const handleMuteParticipant = useCallback(async (targetId) => {
    try {
      await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mute-individual", targetIdentity: targetId }),
      });
      if (socketRef.current) {
        socketRef.current.emit("room-moderation", {
          action: "mute-individual",
          targetIdentity: targetId,
          roomId: cleanRoomCode,
        });
      }
    } catch (_) {}
  }, [cleanRoomCode, socketRef]);

  const handleRemoveParticipant = useCallback(async (targetId) => {
    try {
      await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-participant", targetIdentity: targetId }),
      });
      if (socketRef.current) {
        socketRef.current.emit("room-moderation", {
          action: "remove-participant",
          targetIdentity: targetId,
          roomId: cleanRoomCode,
        });
      }
    } catch (_) {}
  }, [cleanRoomCode, socketRef]);

  const handleTransferHost = useCallback(async (targetId) => {
    try {
      await fetch(`${SERVER_URL}/api/v1/rooms/${cleanRoomCode}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer-host", targetIdentity: targetId }),
      });
      if (socketRef.current) {
        socketRef.current.emit("room-moderation", {
          action: "transfer-host",
          targetIdentity: targetId,
          roomId: cleanRoomCode,
        });
      }
    } catch (_) {}
  }, [cleanRoomCode, socketRef]);

  const handleAdmit = useCallback((wp) => {
    if (socketRef.current) {
      socketRef.current.emit("waiting-room-decision", {
        roomId: cleanRoomCode,
        targetSocketId: wp.socketId,
        targetIdentity: wp.identity,
        approved: true,
      });
    }
    setWaitingParticipants((prev) => prev.filter((p) => p.socketId !== wp.socketId));
  }, [cleanRoomCode, socketRef]);

  const handleDeny = useCallback((wp) => {
    if (socketRef.current) {
      socketRef.current.emit("waiting-room-decision", {
        roomId: cleanRoomCode,
        targetSocketId: wp.socketId,
        targetIdentity: wp.identity,
        approved: false,
      });
    }
    setWaitingParticipants((prev) => prev.filter((p) => p.socketId !== wp.socketId));
  }, [cleanRoomCode, socketRef]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = reader.result;
      const isImg = file.type.startsWith("image/");
      const stableId = `${Date.now()}-${socketRef.current?.id || "local"}-${Math.random().toString(36).slice(2, 7)}`;
      const payload = {
        id: stableId,
        data: isImg ? `[Image: ${file.name}]` : `[File: ${file.name}]`,
        sender: username,
        socketId: socketRef.current?.id,
        fileUrl: fileData,
        fileName: file.name,
        fileType: file.type,
      };

      setMessages((prev) => [...prev, payload]);
      if (socketRef.current?.connected) {
        socketRef.current.emit("chat-message", payload, username, stableId);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [socketRef, username]);

  const handlePiP = useCallback((videoElement) => {
    if (typeof document !== "undefined" && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (videoElement?.requestPictureInPicture) {
      videoElement.requestPictureInPicture().catch(() => {});
    }
  }, []);

  // Keyboard Shortcuts: M mute, V camera, S screen, H hand raise, C chat, P participants, Esc leave confirm
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }
      const key = e.key.toUpperCase();
      if (key === "M") toggleMic();
      else if (key === "V") toggleCamera();
      else if (key === "S") toggleScreenShare();
      else if (key === "H") handleToggleHandRaise();
      else if (key === "C") toggleChat();
      else if (key === "P") toggleParticipants();
      else if (e.key === "Escape") setShowLeaveConfirm((p) => !p);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMic, toggleCamera, toggleScreenShare, handleToggleHandRaise, toggleChat, toggleParticipants]);

  // SpeechRecognition setup for Live Captions
  useEffect(() => {
    if (!showCaptions) return;
    const SpeechRec =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SpeechRec) return;

    let recognition = null;
    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult && lastResult[0]?.transcript) {
          const text = lastResult[0].transcript.trim();
          if (text && socketRef.current) {
            socketRef.current.emit("transcription-chunk", {
              text,
              speaker: username,
              isFinal: lastResult.isFinal,
              roomId: cleanRoomCode,
            });
          }
        }
      };

      recognition.onerror = () => {};
      recognition.start();
    } catch (_) {}

    return () => {
      try {
        if (recognition) recognition.stop();
      } catch (_) {}
    };
  }, [showCaptions, cleanRoomCode, username, socketRef]);


  // Screen share & presentation resolution
  const screenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed !== false
  );
  const isPresentationActive = Boolean(screenTrack);
  const isSelfPresenting = Boolean(screenTrack && screenTrack.participant?.isLocal);
  const presenter = screenTrack ? screenTrack.participant : null;
  const presenterCamTrack = presenter
    ? tracks.find(
        (t) =>
          t.participant.identity === presenter.identity &&
          t.source === Track.Source.Camera &&
          t.publication?.isSubscribed !== false
      )
    : null;

  // Gallery grid sizing
  const totalInCall = participants.length;
  const galleryGridClass =
    totalInCall === 1
      ? styles.gridCount1
      : totalInCall === 2
      ? styles.gridCount2
      : totalInCall <= 4
      ? styles.gridCount4
      : totalInCall <= 6
      ? styles.gridCount6
      : styles.gridCountMany;

  // Format participant items for ParticipantsPanel
  const remoteParticipantsForPanel = participants
    .filter((p) => !p.isLocal)
    .map((p) => ({
      socketId: p.identity,
      username: p.name || `Participant (${p.identity.slice(0, 5)})`,
      isGuest: false,
      connectionStatus: p.connectionQuality === "poor" ? "degraded" : "connected",
      mediaState: {
        mic: p.isMicrophoneEnabled,
        camera: p.isCameraEnabled,
        screenSharing: p.isScreenShareEnabled,
        isSpeaking: p.isSpeaking,
      },
    }));

  const localParticipantForPanel = {
    username: localParticipant?.name || username || "You",
    isGuest: Boolean(isGuest),
    camera: localParticipant?.isCameraEnabled ?? true,
    mic: localParticipant?.isMicrophoneEnabled ?? true,
    screenSharing: localParticipant?.isScreenShareEnabled ?? false,
    isSpeaking: localParticipant?.isSpeaking ?? false,
    connectionStatus: "connected",
  };

  return (
    <div className={styles.meetVideoContainer}>
      {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        activeCameraId={activeCameraIdRef.current}
        activeMicId={activeMicIdRef.current}
        onSelectCamera={handleSelectCamera}
        onSelectMic={handleSelectMic}
      />

      {/* Floating Chat Toast Notification */}
      {chatToast && !showChat && (
        <div
          className={styles.chatToast}
          onClick={() => {
            setShowChat(true);
            setShowParticipants(false);
            setNewMessages(0);
            setChatToast(null);
          }}
          role="alert"
        >
          <div className={styles.chatToastHeader}>
            <span className={styles.chatToastSender}>{chatToast.sender}</span>
            <CloseIcon style={{ fontSize: 14, color: "var(--text-muted)" }} />
          </div>
          <span className={styles.chatToastBody}>{chatToast.data}</span>
        </div>
      )}

      {/* Floating Reactions Overlay */}
      {floatingReactions.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            right: 40,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {floatingReactions.map((r) => (
            <div
              key={r.reactId}
              style={{
                fontSize: "2rem",
                animation: "fadeUp 2.5s ease-out forwards",
                textShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              {r.emoji}
            </div>
          ))}
        </div>
      )}

      {/* In-Call Header */}
      <header className={styles.inCallHeader}>
        <div className={styles.inCallBadgeGroup}>
          <div className={styles.roomInfoBadge}>
            <div className={styles.roomLiveDot} />
            <span className={styles.roomCodeDisplay}>{cleanRoomCode}</span>
            <button
              type="button"
              className={styles.copyCodeBtn}
              onClick={copyRoomCode}
              title="Copy room code"
            >
              <ContentCopyIcon
                style={{ fontSize: 13, marginRight: 4, verticalAlign: "middle" }}
              />
              {copied ? "Code Copied!" : "Copy Code"}
            </button>
          </div>

          <div
            className={styles.callTimerBadge}
            onClick={toggleParticipants}
            style={{ cursor: "pointer" }}
            title="View Participants"
          >
            <PeopleIcon style={{ fontSize: 14 }} />
            <span>{participants.length} in call</span>
          </div>

          <button
            type="button"
            className={styles.copyCodeBtn}
            onClick={handleToggleViewMode}
            title="Toggle Speaker / Gallery View"
          >
            {viewMode === "gallery" ? (
              <ViewStreamIcon style={{ fontSize: 13, marginRight: 4, verticalAlign: "middle" }} />
            ) : (
              <ViewModuleIcon style={{ fontSize: 13, marginRight: 4, verticalAlign: "middle" }} />
            )}
            {viewMode === "gallery" ? "Speaker View" : "Gallery View"}
          </button>

          {isRecording && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(255, 92, 92, 0.2)",
                border: "1px solid rgba(255, 92, 92, 0.4)",
                padding: "3px 8px",
                borderRadius: 12,
              }}
            >
              <FiberManualRecordIcon style={{ fontSize: 11, color: "var(--danger, #FF5C5C)" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--danger, #FF5C5C)" }}>
                REC
              </span>
            </div>
          )}

          <div className={styles.callTimerBadge} title="End-to-End Encrypted Room">
            <LockIcon style={{ fontSize: 13, color: "var(--speaking, #5FD39A)" }} />
            <span>Encrypted</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <NetworkStatusBadge />
          <div className={styles.callTimerBadge}>
            <span>Elapsed:</span>
            <strong className="tabular-nums">{formatDuration(elapsedSeconds)}</strong>
          </div>
        </div>
      </header>

      {/* Host Waiting Room Banner */}
      {isHost && waitingParticipants.length > 0 && (
        <div
          style={{
            background: "rgba(245, 196, 81, 0.15)",
            border: "1px solid rgba(245, 196, 81, 0.3)",
            padding: "6px 14px",
            borderRadius: 8,
            margin: "6px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "var(--idle, #F5C451)" }}>
            <strong>{waitingParticipants[0].name || waitingParticipants[0].identity}</strong> is waiting to join ({waitingParticipants.length} total)
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => handleAdmit(waitingParticipants[0])}
              style={{
                padding: "3px 8px",
                background: "var(--speaking, #5FD39A)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Admit
            </button>
            <button
              type="button"
              onClick={() => handleDeny(waitingParticipants[0])}
              style={{
                padding: "3px 8px",
                background: "rgba(255, 92, 92, 0.2)",
                color: "var(--danger, #FF5C5C)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Breakout Room Banner */}
      {breakoutBanner && (
        <div
          style={{
            background: "rgba(95, 211, 154, 0.15)",
            border: "1px solid rgba(95, 211, 154, 0.3)",
            padding: "6px 14px",
            borderRadius: 8,
            margin: "6px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "var(--speaking, #5FD39A)" }}>
            Assigned to Breakout Room: <strong>{breakoutBanner.roomName}</strong>
          </span>
          <button
            type="button"
            onClick={() => setBreakoutBanner(null)}
            style={{
              padding: "3px 8px",
              background: "var(--speaking, #5FD39A)",
              color: "#000",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Got It
          </button>
        </div>
      )}


      {/* Stage Area: Presentation or Gallery + Side Panels */}
      <div className={styles.stageArea}>
        <div className={styles.mainMediaViewport}>
          {isPresentationActive ? (
            /* ── Presentation Mode: Stage + Sharer PiP + Bottom Participant Strip ── */
            <div className={styles.presentationContainer}>
              <div className={styles.presentationStage}>
                <div className={styles.presentationHeader}>
                  <ScreenShareIcon
                    style={{ fontSize: 16, color: "var(--accent, #FF7A59)" }}
                  />
                  <span>
                    Screen Shared by{" "}
                    <strong>
                      {isSelfPresenting
                        ? `You (${username || "Me"})`
                        : presenter?.name || presenter?.identity || "Participant"}
                    </strong>
                  </span>
                </div>

                <div className={styles.presentationVideoWrapper}>
                  <VideoTrack
                    trackRef={screenTrack}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>

                {/* Presenter Camera PiP */}
                <div className={styles.presenterPipTile}>
                  {presenterCamTrack && presenter?.isCameraEnabled ? (
                    <VideoTrack
                      trackRef={presenterCamTrack}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: presenter.isLocal ? "scaleX(-1)" : "none",
                      }}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholderTile}>
                      <div
                        className={styles.avatarInitialCircle}
                        style={{ width: 44, height: 44, fontSize: 16 }}
                      >
                        {getUserInitials(
                          presenter?.name || (presenter?.isLocal ? username : presenter?.identity)
                        )}
                      </div>
                    </div>
                  )}
                  <div className={styles.localUserTag}>
                    {isSelfPresenting
                      ? `You (${username || "Me"})`
                      : presenter?.name || presenter?.identity || "Presenter"}
                  </div>
                </div>
              </div>

              {/* Bottom Participant Strip */}
              <div className={styles.presentationStrip}>
                {participants
                  .filter((p) => p.identity !== presenter?.identity)
                  .map((peer) => {
                    const camTrack = tracks.find(
                      (t) =>
                        t.participant.identity === peer.identity &&
                        t.source === Track.Source.Camera &&
                        t.publication?.isSubscribed !== false
                    );
                    const isCamOn = peer.isCameraEnabled && camTrack;

                    return (
                      <div
                        key={peer.identity}
                        className={`${styles.stripTile} ${peer.isSpeaking ? styles.speakingRowGlow : ""}`}
                      >
                        {isCamOn ? (
                          <VideoTrack
                            trackRef={camTrack}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              transform: peer.isLocal ? "scaleX(-1)" : "none",
                            }}
                          />
                        ) : (
                          <div className={styles.avatarPlaceholderTile}>
                            <div
                              className={styles.avatarInitialCircle}
                              style={{ width: 36, height: 36, fontSize: 13 }}
                            >
                              {getUserInitials(peer.name || (peer.isLocal ? username : peer.identity))}
                            </div>
                          </div>
                        )}
                        <div className={styles.participantLabelOverlay}>
                          <span>
                            {peer.isLocal ? `You (${username || "Me"})` : peer.name || `Participant (${peer.identity.slice(0, 5)})`}
                          </span>
                          {!peer.isMicrophoneEnabled && (
                            <MicOffIcon
                              style={{ fontSize: 11, color: "var(--danger, #FF5C5C)" }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : viewMode === "speaker" && participants.length > 1 ? (
            /* ── Speaker View: Large Spotlight on Active Speaker + Thumbnail Strip ── */
            <div className={styles.speakerContainer}>
              <div className={styles.speakerStage}>
                {(() => {
                  const activeSpeaker =
                    participants.find((p) => p.isSpeaking && !p.isLocal) ||
                    participants.find((p) => !p.isLocal) ||
                    participants[0];
                  const spCam = tracks.find(
                    (t) =>
                      t.participant.identity === activeSpeaker.identity &&
                      t.source === Track.Source.Camera &&
                      t.publication?.isSubscribed !== false
                  );
                  const isSpCam = activeSpeaker.isCameraEnabled && spCam;
                  const isHand =
                    raisedHands.has(activeSpeaker.identity) ||
                    (activeSpeaker.isLocal && isHandRaised);

                  return (
                    <div
                      className={styles.videoWrapper}
                      style={{ width: "100%", height: "100%", position: "relative" }}
                    >
                      {isSpCam ? (
                        <VideoTrack
                          trackRef={spCam}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transform: activeSpeaker.isLocal ? "scaleX(-1)" : "none",
                          }}
                        />
                      ) : (
                        <div className={styles.avatarPlaceholderTile}>
                          <div
                            className={`${styles.avatarInitialCircle} ${
                              activeSpeaker.isSpeaking ? styles.speakingRingOuter : ""
                            }`}
                            style={{ width: 80, height: 80, fontSize: 32 }}
                          >
                            {getUserInitials(
                              activeSpeaker.name ||
                                (activeSpeaker.isLocal ? username : activeSpeaker.identity)
                            )}
                          </div>
                        </div>
                      )}
                      {isHand && (
                        <div className={styles.handBadge} title="Hand raised">
                          ✋
                        </div>
                      )}
                      {isSpCam && (
                        <button
                          type="button"
                          className={styles.pipBtn}
                          title="Picture-in-Picture"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePiP(e.currentTarget.parentElement.querySelector("video"));
                          }}
                        >
                          <PictureInPictureAltIcon style={{ fontSize: 13 }} />
                        </button>
                      )}
                      <div className={styles.participantLabelOverlay}>
                        <span>
                          {activeSpeaker.isLocal
                            ? `You (${username || "Me"})`
                            : activeSpeaker.name ||
                              `Participant (${activeSpeaker.identity.slice(0, 5)})`}{" "}
                          (Speaker)
                        </span>
                        {!activeSpeaker.isMicrophoneEnabled && (
                          <MicOffIcon
                            style={{ fontSize: 13, color: "var(--danger, #FF5C5C)" }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom Thumbnail Strip */}
              <div className={styles.presentationStrip}>
                {participants.map((peer) => {
                  const camTrack = tracks.find(
                    (t) =>
                      t.participant.identity === peer.identity &&
                      t.source === Track.Source.Camera &&
                      t.publication?.isSubscribed !== false
                  );
                  const isCamOn = peer.isCameraEnabled && camTrack;
                  const isHand =
                    raisedHands.has(peer.identity) || (peer.isLocal && isHandRaised);

                  return (
                    <div
                      key={peer.identity}
                      className={`${styles.stripTile} ${
                        peer.isSpeaking ? styles.speakingRowGlow : ""
                      }`}
                      style={{ position: "relative" }}
                    >
                      {isCamOn ? (
                        <VideoTrack
                          trackRef={camTrack}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transform: peer.isLocal ? "scaleX(-1)" : "none",
                          }}
                        />
                      ) : (
                        <div className={styles.avatarPlaceholderTile}>
                          <div
                            className={styles.avatarInitialCircle}
                            style={{ width: 36, height: 36, fontSize: 13 }}
                          >
                            {getUserInitials(
                              peer.name || (peer.isLocal ? username : peer.identity)
                            )}
                          </div>
                        </div>
                      )}
                      {isHand && (
                        <div
                          className={styles.handBadge}
                          style={{ top: 4, left: 4, width: 22, height: 22, fontSize: 11 }}
                          title="Hand raised"
                        >
                          ✋
                        </div>
                      )}
                      <div className={styles.participantLabelOverlay}>
                        <span>
                          {peer.isLocal
                            ? `You (${username || "Me"})`
                            : peer.name ||
                              `Participant (${peer.identity.slice(0, 5)})`}
                        </span>
                        {!peer.isMicrophoneEnabled && (
                          <MicOffIcon
                            style={{ fontSize: 11, color: "var(--danger, #FF5C5C)" }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Gallery Mode: Responsive Balanced Grid (1x1, 2x1, 2x2, 3x2, Paged 25 max) ── */
            <div className={styles.galleryContainer}>
              {participants.length <= 1 ? (
                /* Solo Participant Waiting Screen */
                <div className={styles.soloWaitingContainer}>
                  <div className={styles.soloPreviewCard}>
                    {localParticipant?.isCameraEnabled ? (
                      (() => {
                        const localCam = tracks.find(
                          (t) => t.participant.isLocal && t.source === Track.Source.Camera
                        );
                        return localCam ? (
                          <VideoTrack
                            trackRef={localCam}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              transform: "scaleX(-1)",
                            }}
                          />
                        ) : null;
                      })()
                    ) : (
                      <div className={styles.avatarPlaceholderTile}>
                        <div
                          className={`${styles.avatarInitialCircle} ${
                            localParticipant?.isSpeaking ? styles.speakingRingOuter : ""
                          }`}
                        >
                          {getUserInitials(username || userData?.name)}
                        </div>
                      </div>
                    )}
                    {isHandRaised && (
                      <div className={styles.handBadge} title="Hand raised">
                        ✋
                      </div>
                    )}
                    <div className={styles.participantLabelOverlay}>
                      <span>You ({username || "Me"})</span>
                    </div>
                  </div>

                  <div className={styles.waitingIconPulse}>
                    <VideocamIcon style={{ fontSize: 32 }} />
                  </div>
                  <h3 className={styles.waitingTitle}>Waiting for others to converge...</h3>
                  <p className={styles.waitingDesc}>
                    Share this room code <strong>{cleanRoomCode}</strong> with others to
                    start conversing.
                  </p>
                  <button
                    type="button"
                    className={styles.copyCodeBtn}
                    onClick={copyRoomCode}
                    style={{
                      padding: "10px 18px",
                      fontSize: "13px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--accent, #FF7A59)",
                      color: "#1A0E09",
                      fontWeight: 700,
                      borderRadius: "8px",
                    }}
                  >
                    <ContentCopyIcon style={{ fontSize: 14 }} />
                    {copied ? `Room Code "${cleanRoomCode}" Copied!` : "Copy Room Code"}
                  </button>
                </div>
              ) : (
                /* Multi-participant Gallery Grid (Paged: 25 tiles max) */
                <>
                  {(() => {
                    const PAGE_SIZE = 25;
                    const totalPages = Math.ceil(participants.length / PAGE_SIZE) || 1;
                    const currentPage = Math.min(gridPage, totalPages - 1);
                    const pagedParticipants = participants.slice(
                      currentPage * PAGE_SIZE,
                      (currentPage + 1) * PAGE_SIZE
                    );

                    return (
                      <>
                        <div className={`${styles.galleryGrid} ${galleryGridClass}`}>
                          {pagedParticipants.map((p) => {
                            const camTrack = tracks.find(
                              (t) =>
                                t.participant.identity === p.identity &&
                                t.source === Track.Source.Camera &&
                                t.publication?.isSubscribed !== false
                            );
                            const isCamOn = p.isCameraEnabled && camTrack;
                            const isHand =
                              raisedHands.has(p.identity) || (p.isLocal && isHandRaised);

                            return (
                              <div
                                key={p.identity}
                                className={`${styles.videoWrapper} ${
                                  p.isSpeaking ? styles.speakingRowGlow : ""
                                }`}
                                style={{ position: "relative" }}
                              >
                                {isCamOn ? (
                                  <VideoTrack
                                    trackRef={camTrack}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      transform: p.isLocal ? "scaleX(-1)" : "none",
                                    }}
                                  />
                                ) : (
                                  <div className={styles.avatarPlaceholderTile}>
                                    <div
                                      className={`${styles.avatarInitialCircle} ${
                                        p.isSpeaking ? styles.speakingRingOuter : ""
                                      }`}
                                    >
                                      {getUserInitials(
                                        p.name || (p.isLocal ? username : p.identity)
                                      )}
                                    </div>
                                    <span className={styles.avatarPlaceholderName}>
                                      {p.name || (p.isLocal ? username : "Participant")}
                                    </span>
                                  </div>
                                )}
                                {isHand && (
                                  <div className={styles.handBadge} title="Hand raised">
                                    ✋
                                  </div>
                                )}
                                {isCamOn && (
                                  <button
                                    type="button"
                                    className={styles.pipBtn}
                                    title="Picture-in-Picture"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePiP(
                                        e.currentTarget.parentElement.querySelector("video")
                                      );
                                    }}
                                  >
                                    <PictureInPictureAltIcon style={{ fontSize: 13 }} />
                                  </button>
                                )}
                                <div className={styles.participantLabelOverlay}>
                                  <span>
                                    {p.isLocal
                                      ? `You (${username || "Me"})`
                                      : p.name ||
                                        `Participant (${p.identity.slice(0, 5)})`}
                                  </span>
                                  {!p.isMicrophoneEnabled && (
                                    <MicOffIcon
                                      style={{
                                        fontSize: 13,
                                        color: "var(--danger, #FF5C5C)",
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {totalPages > 1 && (
                          <div className={styles.paginationControls}>
                            <button
                              type="button"
                              className={styles.pageBtn}
                              disabled={currentPage === 0}
                              onClick={() => setGridPage((prev) => Math.max(0, prev - 1))}
                            >
                              Previous
                            </button>
                            <span className={styles.pageInfo}>
                              Page {currentPage + 1} of {totalPages} ({participants.length}{" "}
                              participants)
                            </span>
                            <button
                              type="button"
                              className={styles.pageBtn}
                              disabled={currentPage >= totalPages - 1}
                              onClick={() =>
                                setGridPage((prev) => Math.min(totalPages - 1, prev + 1))
                              }
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>

        {/* Live Captions Overlay */}
        {showCaptions && captions.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 82,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(6px)",
              color: "#F3EEE6",
              padding: "8px 20px",
              borderRadius: "8px",
              maxWidth: "80%",
              textAlign: "center",
              zIndex: 60,
              fontSize: "0.95rem",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
            }}
          >
            <span
              style={{
                color: "var(--accent, #FF7A59)",
                fontWeight: 600,
                marginRight: 8,
              }}
            >
              {captions[captions.length - 1].speaker}:
            </span>
            <span>{captions[captions.length - 1].text}</span>
          </div>
        )}

        {/* Participants Panel */}
        <ParticipantsPanel
          isOpen={showParticipants}
          onClose={() => setShowParticipants(false)}
          participants={remoteParticipantsForPanel}
          localParticipant={localParticipantForPanel}
          isHost={isHost}
          isLocked={isLocked}
          waitingParticipants={waitingParticipants}
          raisedHands={raisedHands}
          onAdmit={handleAdmit}
          onDeny={handleDeny}
          onMuteAll={handleMuteAll}
          onToggleLock={handleToggleLock}
          onMuteParticipant={handleMuteParticipant}
          onRemoveParticipant={handleRemoveParticipant}
          onTransferHost={handleTransferHost}
        />

        {/* In-Call Messages Side Panel */}
        {showChat && (
          <aside className={styles.sidePanelContainer} aria-label="In-Call Chat">
            <div className={styles.chatContainer}>
              <div className={styles.sidePanelHeader}>
                <h2 className={styles.chatHeaderTitle}>In-Call Messages</h2>
                <button
                  type="button"
                  className={styles.closeChatBtn}
                  onClick={() => setShowChat(false)}
                  title="Close chat"
                >
                  <CloseIcon fontSize="small" />
                </button>
              </div>

              <div className={styles.chattingDisplay} ref={chatBottomRef}>
                {messages.length !== 0 ? (
                  messages.map((item) => {
                    const isSelf = item.sender === (username || "You");
                    return (
                      <div
                        className={`${styles.chatMsgBubble} ${
                          isSelf ? styles.chatMsgSelf : ""
                        }`}
                        key={item.id}
                      >
                        <div className={styles.chatSender}>{item.sender}</div>
                        <div className={styles.chatText}>{item.data}</div>
                        {item.fileUrl && (
                          <div style={{ marginTop: 6 }}>
                            {item.fileType?.startsWith("image/") ||
                            item.data?.startsWith("[Image:") ? (
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={item.fileUrl}
                                  alt={item.fileName || "attachment"}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: 180,
                                    borderRadius: 6,
                                    display: "block",
                                  }}
                                />
                              </a>
                            ) : (
                              <a
                                href={item.fileUrl}
                                download={item.fileName || "file"}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "4px 8px",
                                  background: "rgba(255, 255, 255, 0.1)",
                                  borderRadius: 4,
                                  color: "var(--accent, #FF7A59)",
                                  fontSize: "12px",
                                  textDecoration: "none",
                                }}
                              >
                                <AttachFileIcon style={{ fontSize: 14 }} />
                                <span>{item.fileName || "Attachment"}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted, #716A5D)",
                      fontSize: "13px",
                      marginTop: "40px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div style={{ fontSize: "20px" }}>💬</div>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "var(--text-secondary, #A8A29E)",
                      }}
                    >
                      No chat messages yet
                    </span>
                    <span style={{ fontSize: "12px", opacity: 0.8 }}>
                      Send a greeting to start the conversation!
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.chattingArea} style={{ position: "relative" }}>
                <EmojiPicker
                  isOpen={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onSelectEmoji={(emoji) => {
                    setMessage((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />

                <button
                  type="button"
                  className={styles.closeChatBtn}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file or image"
                  style={{ marginRight: 4 }}
                >
                  <AttachFileIcon fontSize="small" />
                </button>

                <button
                  type="button"
                  className={styles.closeChatBtn}
                  onClick={() => setShowEmojiPicker((p) => !p)}
                  title="Insert emoji"
                  style={{ marginRight: 6 }}
                >
                  <InsertEmoticonIcon fontSize="small" />
                </button>

                <input
                  type="text"
                  className={styles.chatInput}
                  placeholder="Type a message or :emoji:..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                />
                <button
                  type="button"
                  className={styles.chatSendBtn}
                  onClick={handleSendMessage}
                  title="Send message"
                >
                  <SendIcon fontSize="small" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Meeting Controls Bar */}
      <nav className={styles.buttonContainers} aria-label="Meeting Controls">
        <button
          type="button"
          className={`${styles.actionCircleBtn} ${
            !localParticipant?.isCameraEnabled ? styles.controlCircleBtnOff : ""
          }`}
          onClick={toggleCamera}
          title={
            localParticipant?.isCameraEnabled
              ? "Turn camera off (V)"
              : "Turn camera on (V)"
          }
        >
          {localParticipant?.isCameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
        </button>

        <button
          type="button"
          className={`${styles.actionCircleBtn} ${
            !localParticipant?.isMicrophoneEnabled ? styles.controlCircleBtnOff : ""
          }`}
          onClick={toggleMic}
          title={
            localParticipant?.isMicrophoneEnabled
              ? "Mute microphone (M)"
              : "Unmute microphone (M)"
          }
        >
          {localParticipant?.isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon />}
        </button>

        <button
          type="button"
          className={`${styles.actionCircleBtn} ${
            localParticipant?.isScreenShareEnabled ? styles.controlCircleBtnOff : ""
          }`}
          onClick={toggleScreenShare}
          title={
            localParticipant?.isScreenShareEnabled
              ? "Stop sharing screen (S)"
              : "Share screen (S)"
          }
        >
          {localParticipant?.isScreenShareEnabled ? (
            <StopScreenShareIcon />
          ) : (
            <ScreenShareIcon />
          )}
        </button>

        <button
          type="button"
          className={`${styles.actionCircleBtn}`}
          onClick={handleToggleHandRaise}
          title={isHandRaised ? "Lower hand (H)" : "Raise hand (H)"}
          style={
            isHandRaised
              ? { background: "var(--accent, #FF7A59)", color: "#1A0E09" }
              : {}
          }
        >
          <PanToolIcon />
        </button>

        <button
          type="button"
          className={`${styles.actionCircleBtn}`}
          onClick={() => setShowCaptions((prev) => !prev)}
          title={showCaptions ? "Turn off captions" : "Turn on captions"}
          style={
            showCaptions
              ? {
                  background: "rgba(95, 211, 154, 0.25)",
                  color: "var(--speaking, #5FD39A)",
                }
              : {}
          }
        >
          <ClosedCaptionIcon />
        </button>

        {isHost && (
          <button
            type="button"
            className={`${styles.actionCircleBtn}`}
            onClick={handleToggleRecording}
            title={isRecording ? "Stop recording" : "Start recording"}
            style={
              isRecording
                ? {
                    background: "rgba(255, 92, 92, 0.25)",
                    color: "var(--danger, #FF5C5C)",
                  }
                : {}
            }
          >
            <FiberManualRecordIcon />
          </button>
        )}

        <button
          type="button"
          className={`${styles.actionCircleBtn} ${
            showParticipants ? styles.controlCircleBtnOff : ""
          }`}
          onClick={toggleParticipants}
          title="Participants list (P)"
        >
          <PeopleIcon />
        </button>

        <button
          type="button"
          className={`${styles.actionCircleBtn} ${
            showChat ? styles.controlCircleBtnOff : ""
          }`}
          onClick={toggleChat}
          title="Toggle chat (C)"
          style={{ position: "relative" }}
        >
          <ChatIcon />
          {newMessages > 0 && (
            <span className={styles.badgeUnread}>{newMessages}</span>
          )}
        </button>

        <button
          type="button"
          className={styles.actionCircleBtn}
          onClick={() => setShowSettingsModal(true)}
          title="Device Settings"
        >
          <SettingsIcon />
        </button>

        <button
          type="button"
          className={`${styles.actionCircleBtn} ${styles.endCallBtn}`}
          onClick={onLeave}
          title="Leave Call (Esc)"
        >
          <CallEndIcon />
        </button>
      </nav>
    </div>
  );
}

/**
 * VideoMeetComponent — Root component managing Lobby, Expiration, and LiveKitRoom lifecycle
 */
export default function VideoMeetComponent() {
  const { url } = useParams();
  const navigate = useNavigate();
  const { userData, accessToken } = useContext(AuthContext);

  const cleanRoomCode = resolvePersonalRoomCode(extractRoomCode(url));

  const socketRef = useRef(null);
  const localPreviewVideoRef = useRef(null);
  const previewStreamRef = useRef(null);
  const activeCameraIdRef = useRef(localStorage.getItem("sangam_camera_id") || "");
  const activeMicIdRef = useRef(localStorage.getItem("sangam_mic_id") || "");

  const [inCall, setInCall] = useState(false);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [cameraContentionNotice, setCameraContentionNotice] = useState("");
  const [roomExpired, setRoomExpired] = useState(false);
  const [roomExpiredMessage, setRoomExpiredMessage] = useState("");
  const [roomLocked, setRoomLocked] = useState(false);
  const [roomLockedMessage, setRoomLockedMessage] = useState("");
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [livekitToken, setLivekitToken] = useState("");
  const [livekitWsUrl, setLivekitWsUrl] = useState("");

  // Video conferencing page is always dark mode
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      document.body.style.overflow = "";
      if (prevTheme) {
        document.documentElement.setAttribute("data-theme", prevTheme);
      } else {
        const stored = localStorage.getItem("sangam_theme") || "dark";
        document.documentElement.setAttribute("data-theme", stored);
      }
    };
  }, []);

  // Prefill username from AuthContext
  useEffect(() => {
    if (userData?.name && !username) {
      setUsername(userData.name);
    }
  }, [userData, username]);

  // Acquire local preview stream for Lobby
  const initPreview = useCallback(async (camId, micId) => {
    setCameraContentionNotice("");
    const selectedCam = camId || activeCameraIdRef.current;
    const selectedMic = micId || activeMicIdRef.current;
    const videoConstraint = selectedCam ? { deviceId: { exact: selectedCam } } : true;
    const audioConstraint = selectedMic ? { deviceId: { exact: selectedMic } } : true;

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: audioConstraint,
        });
        previewStreamRef.current = stream;
        setVideoAvailable(stream.getVideoTracks().length > 0);
        setAudioAvailable(stream.getAudioTracks().length > 0);
        if (localPreviewVideoRef.current) {
          localPreviewVideoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError" ||
        err.name === "OverconstrainedError"
      ) {
        setCameraContentionNotice(
          "Camera is in use by another application. Continuing with audio only."
        );
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioConstraint,
          });
          previewStreamRef.current = audioStream;
          setAudioAvailable(true);
          setVideoAvailable(false);
          setCameraEnabled(false);
        } catch (_) {}
      }
    }
  }, []);

  useEffect(() => {
    if (askForUsername) {
      initPreview();
    }
    return () => {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
    };
  }, [askForUsername, initPreview]);

  // Join meeting handler
  const handleJoinMeeting = async () => {
    if (!username.trim()) return;

    // Stop lobby preview stream before LiveKit room acquires devices
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }

    const userIdentity = `${username.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`;

    try {
      const res = await fetch(`${SERVER_URL}/api/v1/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: cleanRoomCode,
          identity: userIdentity,
          name: username.trim(),
          isGuest: !userData?.id,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.code === "ROOM_EXPIRED") {
          setRoomExpired(true);
          setRoomExpiredMessage(data.message);
          return;
        }
        if (data.code === "ROOM_LOCKED") {
          setRoomLocked(true);
          setRoomLockedMessage(data.message || "This room has been locked by the host.");
          return;
        }
      }

      if (!res.ok) {
        throw new Error("Failed to authenticate into meeting room.");
      }

      const data = await res.json();
      const { token, url: wsUrl } = data;
      setLivekitToken(token);
      setLivekitWsUrl(wsUrl);
      setIsHost(Boolean(data.isHost));
      setIsLocked(Boolean(data.isLocked));
      setIsRecording(Boolean(data.isRecording));

      // Connect Socket.IO for chat persistence & room metadata
      const socket = getSocket(accessToken);
      socketRef.current = socket;
      if (!socket.connected) {
        socket.connect();
      }

      socket.on("room-error", (err) => {
        if (err?.code === "ROOM_EXPIRED") {
          setRoomExpired(true);
          setRoomExpiredMessage(err.message);
        }
      });

      if (data.isWaiting) {
        setIsWaitingApproval(true);
        setAskForUsername(false);

        socket.emit("waiting-room-join", {
          roomId: cleanRoomCode,
          identity: userIdentity,
          name: username.trim(),
        });

        socket.on("waiting-room-response", (resp) => {
          if (resp?.approved) {
            setIsWaitingApproval(false);
            setInCall(true);
            socket.emit("join-call", cleanRoomCode, {
              username: username.trim(),
              userId: userData?.id || null,
              isGuest: !userData?.id,
            });
          } else {
            setIsWaitingApproval(false);
            alert("Your request to join this meeting was declined by the host.");
            navigate("/home");
          }
        });
        return;
      }

      socket.emit("join-call", cleanRoomCode, {
        username: username.trim(),
        userId: userData?.id || null,
        isGuest: !userData?.id,
      });

      setAskForUsername(false);
      setInCall(true);
    } catch (err) {
      console.error("Join meeting error:", err);
    }
  };

  // Leave meeting handler
  const handleLeaveCall = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit("leave-call");
      disconnectSocket();
      socketRef.current = null;
    }
    setInCall(false);
    navigate("/home");
  }, [navigate]);

  return (
    <div className={styles.videoPageRoot} data-theme="dark">
      {roomExpired ? (
        <div className={styles.lobbyContainer}>
          <div className={styles.bgAtmosphere}>
            <div className={styles.glowOrbCoral} />
            <div className={styles.glowOrbAmber} />
            <div className={styles.gridPattern} />
          </div>

          <header className={styles.lobbyHeader}>
            <div className={styles.navLeft} onClick={() => navigate("/home")}>
              <img
                src="/assets/branding/sangam-logo.png"
                alt="Sangam Connect"
                className={styles.brandLogo}
              />
              <div className={styles.brandTextGroup}>
                <span className={styles.brandTitle}>Sangam Connect</span>
                <span className={styles.brandTagline}>ROOM EXPIRED</span>
              </div>
            </div>
          </header>

          <main
            className={styles.lobbyMain}
            style={{ display: "flex", justifyContent: "center" }}
          >
            <div
              className={styles.joinCard}
              style={{ maxWidth: 460, textAlign: "center" }}
            >
              <div
                className={styles.waitingIconPulse}
                style={{
                  margin: "0 auto 18px",
                  background: "rgba(255, 92, 92, 0.12)",
                  borderColor: "rgba(255, 92, 92, 0.3)",
                }}
              >
                <TimerOffIcon
                  style={{ fontSize: 32, color: "var(--danger, #FF5C5C)" }}
                />
              </div>
              <h1
                className={styles.cardHeading}
                style={{ color: "var(--danger, #FF5C5C)" }}
              >
                Meeting Expired
              </h1>
              <p className={styles.cardSubtext} style={{ marginBottom: 24 }}>
                {roomExpiredMessage ||
                  "This meeting room has expired due to 15 minutes of inactivity."}
              </p>
              <button
                type="button"
                className={styles.chatSendBtn}
                onClick={() => navigate("/home")}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                Return to Home
              </button>
            </div>
          </main>
        </div>
      ) : roomLocked ? (
        <div className={styles.lobbyContainer}>
          <div className={styles.bgAtmosphere}>
            <div className={styles.glowOrbCoral} />
            <div className={styles.glowOrbAmber} />
            <div className={styles.gridPattern} />
          </div>

          <header className={styles.lobbyHeader}>
            <div className={styles.navLeft} onClick={() => navigate("/home")}>
              <img
                src="/assets/branding/sangam-logo.png"
                alt="Sangam Connect"
                className={styles.brandLogo}
              />
              <div className={styles.brandTextGroup}>
                <span className={styles.brandTitle}>Sangam Connect</span>
                <span className={styles.brandTagline}>ROOM LOCKED</span>
              </div>
            </div>
          </header>

          <main
            className={styles.lobbyMain}
            style={{ display: "flex", justifyContent: "center" }}
          >
            <div
              className={styles.joinCard}
              style={{ maxWidth: 460, textAlign: "center" }}
            >
              <div
                className={styles.waitingIconPulse}
                style={{
                  margin: "0 auto 18px",
                  background: "rgba(255, 92, 92, 0.12)",
                  borderColor: "rgba(255, 92, 92, 0.3)",
                }}
              >
                <LockIcon
                  style={{ fontSize: 32, color: "var(--danger, #FF5C5C)" }}
                />
              </div>
              <h1
                className={styles.cardHeading}
                style={{ color: "var(--danger, #FF5C5C)" }}
              >
                Room Locked
              </h1>
              <p className={styles.cardSubtext} style={{ marginBottom: 24 }}>
                {roomLockedMessage || "This meeting room is locked by the host."}
              </p>
              <button
                type="button"
                className={styles.chatSendBtn}
                onClick={() => navigate("/home")}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                Return to Home
              </button>
            </div>
          </main>
        </div>
      ) : isWaitingApproval ? (
        <div className={styles.lobbyContainer}>
          <div className={styles.bgAtmosphere}>
            <div className={styles.glowOrbCoral} />
            <div className={styles.glowOrbAmber} />
            <div className={styles.gridPattern} />
          </div>

          <header className={styles.lobbyHeader}>
            <div className={styles.navLeft} onClick={() => navigate("/home")}>
              <img
                src="/assets/branding/sangam-logo.png"
                alt="Sangam Connect"
                className={styles.brandLogo}
              />
              <div className={styles.brandTextGroup}>
                <span className={styles.brandTitle}>Sangam Connect</span>
                <span className={styles.brandTagline}>WAITING ROOM</span>
              </div>
            </div>
          </header>

          <main
            className={styles.lobbyMain}
            style={{ display: "flex", justifyContent: "center" }}
          >
            <div
              className={styles.joinCard}
              style={{ maxWidth: 460, textAlign: "center" }}
            >
              <div
                className={styles.waitingIconPulse}
                style={{
                  margin: "0 auto 18px",
                  background: "rgba(245, 196, 81, 0.15)",
                  borderColor: "rgba(245, 196, 81, 0.3)",
                }}
              >
                <VideocamIcon
                  style={{ fontSize: 32, color: "var(--idle, #F5C451)" }}
                />
              </div>
              <h1
                className={styles.cardHeading}
                style={{ color: "var(--idle, #F5C451)" }}
              >
                Waiting for Host
              </h1>
              <p className={styles.cardSubtext} style={{ marginBottom: 24 }}>
                The meeting host has been notified that you are waiting. You will join automatically once approved.
              </p>
              <button
                type="button"
                className={styles.chatSendBtn}
                onClick={() => {
                  setIsWaitingApproval(false);
                  navigate("/home");
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: 700,
                  background: "rgba(255, 92, 92, 0.15)",
                  color: "var(--danger, #FF5C5C)",
                  border: "1px solid rgba(255, 92, 92, 0.3)",
                }}
              >
                Leave Waiting Room
              </button>
            </div>
          </main>
        </div>
      ) : askForUsername ? (
        /* ── LOBBY / PRE-JOIN SCREEN ───────────────────────────────────── */
        <div className={styles.lobbyContainer}>
          <DeviceSettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            activeCameraId={activeCameraIdRef.current}
            activeMicId={activeMicIdRef.current}
            onSelectCamera={(id) => {
              activeCameraIdRef.current = id;
              localStorage.setItem("sangam_camera_id", id);
              initPreview(id, activeMicIdRef.current);
            }}
            onSelectMic={(id) => {
              activeMicIdRef.current = id;
              localStorage.setItem("sangam_mic_id", id);
              initPreview(activeCameraIdRef.current, id);
            }}
            activeStream={previewStreamRef.current}
          />
          <div className={styles.bgAtmosphere}>
            <div className={styles.glowOrbCoral} />
            <div className={styles.glowOrbAmber} />
            <div className={styles.gridPattern} />
          </div>

          <header className={styles.lobbyHeader}>
            <div className={styles.navLeft} onClick={() => navigate("/home")}>
              <img
                src="/assets/branding/sangam-logo.png"
                alt="Sangam Connect"
                className={styles.brandLogo}
              />
              <div className={styles.brandTextGroup}>
                <span className={styles.brandTitle}>Sangam Connect</span>
                <span className={styles.brandTagline}>WHERE VOICES CONVERGE</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <NetworkStatusBadge />
              <div className={styles.roomBadge}>
                <span>Room:</span>
                <span className={styles.roomCodeText}>{cleanRoomCode}</span>
              </div>
            </div>
          </header>

          <main className={styles.lobbyMain}>
            <div className={styles.previewBox}>
              <video
                ref={localPreviewVideoRef}
                autoPlay
                muted
                playsInline
                aria-label="Local camera preview"
                className={styles.previewVideo}
                style={{
                  display: videoAvailable && cameraEnabled ? "block" : "none",
                }}
              />

              {(!videoAvailable || !cameraEnabled) && (
                <div className={styles.videoOffPlaceholder}>
                  <div className={styles.placeholderAvatar}>
                    {getUserInitials(username || userData?.name)}
                  </div>
                  <span>
                    {cameraContentionNotice
                      ? "Camera in use"
                      : !videoAvailable
                      ? "Camera unavailable"
                      : "Camera is turned off"}
                  </span>
                </div>
              )}

              <div className={styles.statusOverlay}>
                <div className={styles.statusDot} />
                <span>Media Pre-check Ready</span>
              </div>

              <div className={styles.previewControlsBar}>
                <button
                  type="button"
                  className={`${styles.controlCircleBtn} ${
                    !cameraEnabled ? styles.controlCircleBtnOff : ""
                  }`}
                  onClick={() => setCameraEnabled((v) => !v)}
                  title="Toggle Camera"
                  disabled={!videoAvailable}
                >
                  {cameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                </button>
                <button
                  type="button"
                  className={`${styles.controlCircleBtn} ${
                    !micEnabled ? styles.controlCircleBtnOff : ""
                  }`}
                  onClick={() => setMicEnabled((v) => !v)}
                  title="Toggle Microphone"
                  disabled={!audioAvailable}
                >
                  {micEnabled ? <MicIcon /> : <MicOffIcon />}
                </button>
                <button
                  type="button"
                  className={styles.controlCircleBtn}
                  onClick={() => setShowSettingsModal(true)}
                  title="Audio & Video Settings"
                >
                  <SettingsIcon />
                </button>
              </div>
            </div>

            <div className={styles.joinCard}>
              <div>
                <h1 className={styles.cardHeading}>Ready to Join?</h1>
                <p className={styles.cardSubtext}>
                  Check your display name and media devices before entering the room.
                </p>
              </div>

              {cameraContentionNotice && (
                <div className={styles.settingsAlert}>
                  <span>⚠️ {cameraContentionNotice}</span>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Your Display Name</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinMeeting();
                  }}
                  required
                />
              </div>

              <button
                type="button"
                className={styles.chatSendBtn}
                onClick={handleJoinMeeting}
                disabled={!username.trim()}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: 700,
                  gap: "8px",
                  cursor: username.trim() ? "pointer" : "not-allowed",
                  opacity: username.trim() ? 1 : 0.6,
                }}
              >
                <VideocamIcon style={{ fontSize: 20 }} />
                <span>Join Meeting Now</span>
              </button>

              <div className={styles.securityNote}>
                🔒 <span>LiveKit SFU Encrypted Real-Time Audio & Video</span>
              </div>
            </div>
          </main>
        </div>
      ) : inCall && livekitToken ? (
        /* ── IN-CALL MEETING VIEWPORT (LiveKit SFU) ─────────────────────── */
        <LiveKitRoom
          token={livekitToken}
          serverUrl={livekitWsUrl}
          connect={true}
          video={cameraEnabled}
          audio={micEnabled}
          onDisconnected={handleLeaveCall}
          data-lk-theme="default"
          style={{ width: "100%", height: "100%" }}
        >
          <RoomAudioRenderer />
          <LiveKitMeetingStage
            cleanRoomCode={cleanRoomCode}
            username={username}
            isGuest={!userData?.id}
            socketRef={socketRef}
            onLeave={handleLeaveCall}
            userData={userData}
            isHost={isHost}
            isLocked={isLocked}
            isRecording={isRecording}
          />
        </LiveKitRoom>
      ) : null}
    </div>
  );
}
