/**
 * VideoMeet.jsx — Sangam Connect Production-Grade Meeting Component
 *
 * Implements full resolution for all 10 reported issues:
 * [ISSUE 1] Local Video Flickering — Stable stream ref with idempotent srcObject binding (only assigns if el.srcObject !== stream).
 * [ISSUE 2] Viewport Fitting — 100dvh full-height shell with flex stage and zero document scrollbars.
 * [ISSUE 3] Screen Share Delivery — Robust display capture with audio fallback, transceiver lookup, media-state signaling, and camera restore.
 * [ISSUE 4] Multi-Participant Local Testing — Device contention (NotReadableError) handled with graceful audio-only fallback + notice.
 * [ISSUE 5] Device Settings — DeviceSettingsModal for camera, mic, and speaker selection with live level meter and test sound.
 * [ISSUE 6] Chat UX & Notifications — Side-panel docking, floating toast notification when closed, Web Audio chime, emoji picker & shortcodes.
 * [ISSUE 7] Duplicate Participants — Deduplicated participant registry, explicit leave-call on unmount, stale socket eviction.
 * [ISSUE 8] Room Code Copying — extractRoomCode() copies only the clean room code, not full URL.
 * [ISSUE 9] Interactive Participants Panel — ParticipantsPanel showing active count, avatars, Member/Guest tags, and live media states.
 * [ISSUE 10] Avatar Placeholder — Branded avatar tile with initials, name, and speaking glow ring when camera is disabled.
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
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
import styles from "../styles/videoComponent.module.css";
import SERVER_URL from "../environment";
import { AuthContext } from "../contexts/AuthContext";
import DeviceSettingsModal from "../components/DeviceSettingsModal";
import ParticipantsPanel from "../components/ParticipantsPanel";
import EmojiPicker, { parseEmojiShortcodes } from "../components/EmojiPicker";
import { extractRoomCode, copyToClipboard } from "../utils/roomUtils";
import { safeCloseAudioContext } from "../utils/audioUtils";
import NetworkStatusBadge from "../components/NetworkStatusBadge";

// ── ICE Configuration ────────────────────────────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ── Structured Logger ────────────────────────────────────────────────────────
const rtcLog = {
  info: (event, fields = {}) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[Sangam:${event}]`, fields);
    }
  },
  warn: (event, fields = {}) => console.warn(`[Sangam:${event}]`, fields),
  error: (event, fields = {}) => console.error(`[Sangam:${event}]`, fields),
};

// ── Web Audio Chime Synthesizer (Zero asset dependencies) ─────────────────────
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

// ── Dummy Media Stream for Initial Transceivers ───────────────────────────────
const silence = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    if (track) {
      track.enabled = false;
      track.addEventListener("ended", () => safeCloseAudioContext(ctx));
      return track;
    }
    safeCloseAudioContext(ctx);
    return null;
  } catch (_) {
    return null;
  }
};

const blackVideoTrack = ({ width = 640, height = 480 } = {}) => {
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  canvas.getContext("2d").fillRect(0, 0, width, height);
  const stream = canvas.captureStream();
  return Object.assign(stream.getVideoTracks()[0], { enabled: false });
};

const createBlackSilenceStream = () => {
  const tracks = [blackVideoTrack()];
  const audioTrack = silence();
  if (audioTrack) tracks.push(audioTrack);
  return new MediaStream(tracks);
};

const isConnectionAlive = (pc) => {
  if (!pc) return false;
  return (
    pc.connectionState !== "closed" &&
    pc.connectionState !== "failed" &&
    pc.signalingState !== "closed"
  );
};

export default function VideoMeetComponent() {
  const { url } = useParams();
  const navigate = useNavigate();
  const { userData } = useContext(AuthContext);

  const cleanRoomCode = extractRoomCode(url);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const connectionsRef = useRef({});
  const chatBottomRef = useRef(null);
  const isScreenSharingRef = useRef(false);
  const screenStreamRef = useRef(null); // active display media stream
  const screenPreviewVideoRef = useRef(null); // <video> element showing local screen in main stage
  const stopScreenShareRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const audioMeterContextRef = useRef(null);
  const activeCameraIdRef = useRef(localStorage.getItem("sangam_camera_id") || "");
  const activeMicIdRef = useRef(localStorage.getItem("sangam_mic_id") || "");
  const iceCandidateQueueRef = useRef({});

  // ── State ─────────────────────────────────────────────────────────────────
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [cameraContentionNotice, setCameraContentionNotice] = useState("");
  const [roomExpired, setRoomExpired] = useState(false);
  const [roomExpiredMessage, setRoomExpiredMessage] = useState("");

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);

  // Map of remote participants: socketId → { socketId, username, userId, isGuest, stream, mediaState, connectionStatus }
  const [participants, setParticipants] = useState({});
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [chatToast, setChatToast] = useState(null);

  const [showModal, setModal] = useState(false); // Chat panel
  const [showParticipants, setShowParticipants] = useState(false); // Participants panel
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Mutually exclusive panel toggles
  const toggleParticipants = useCallback(() => {
    setShowParticipants((prev) => {
      if (!prev) setModal(false);
      return !prev;
    });
  }, []);

  const toggleChat = useCallback(() => {
    setModal((prev) => {
      if (!prev) setShowParticipants(false);
      return !prev;
    });
    setNewMessages(0);
    setChatToast(null);
  }, []);

  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [socketStatus, setSocketStatus] = useState("disconnected");

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

  // Meeting duration timer
  useEffect(() => {
    if (askForUsername) return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [askForUsername]);

  // Scroll chat on new messages
  useEffect(() => {
    if (showModal && chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
  }, [messages, showModal]);

  // ── [ISSUE 1] Lifecycle-Safe Video Binding (Fixes Flickering & Black Screen) ──
  const bindLocalVideo = useCallback((node) => {
    localVideoRef.current = node;
    if (node && localStreamRef.current && node.srcObject !== localStreamRef.current) {
      node.srcObject = localStreamRef.current;
    }
    if (node) {
      node.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [cameraEnabled]);

  const bindScreenPreview = useCallback((node) => {
    screenPreviewVideoRef.current = node;
    if (node && screenStreamRef.current && node.srcObject !== screenStreamRef.current) {
      node.srcObject = screenStreamRef.current;
    }
    if (node) {
      node.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (screenPreviewVideoRef.current && screenStreamRef.current) {
      if (screenPreviewVideoRef.current.srcObject !== screenStreamRef.current) {
        screenPreviewVideoRef.current.srcObject = screenStreamRef.current;
      }
      screenPreviewVideoRef.current.play().catch(() => {});
    }
  }, [screenSharing]);

  const bindRemoteVideo = useCallback(
    (stream) => (node) => {
      if (!node) return;
      if (stream && node.srcObject !== stream) {
        node.srcObject = stream;
      }
      node.play().catch(() => {});
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          track.onunmute = () => {
            node.play().catch(() => {});
          };
        });
      }
    },
    []
  );

  // ── Media Acquisition with Device Contention Fallback ──────────────────────
  const acquireLocalStream = useCallback(
    async (videoConstraint, audioConstraint, cameraId, micId) => {
      setCameraContentionNotice("");

      const videoPref = cameraId || activeCameraIdRef.current;
      const micPref = micId || activeMicIdRef.current;

      const videoConfig = videoConstraint
        ? videoPref
          ? { deviceId: { exact: videoPref } }
          : true
        : false;

      const audioConfig = audioConstraint
        ? micPref
          ? { deviceId: { exact: micPref } }
          : true
        : false;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConfig,
          audio: audioConfig,
        });
        return stream;
      } catch (err) {
        rtcLog.warn("media_acquisition_error", { name: err.name, message: err.message });

        // [ISSUE 4] If physical camera is locked by another window/app, fall back to audio-only
        if (
          err.name === "NotReadableError" ||
          err.name === "TrackStartError" ||
          err.name === "OverconstrainedError"
        ) {
          setCameraContentionNotice(
            "Camera is in use by another application or browser window. Continuing with microphone only."
          );
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: audioConfig,
            });
            setVideoAvailable(false);
            setCameraEnabled(false);
            return audioOnly;
          } catch (audioErr) {
            rtcLog.error("audio_fallback_failed", { error: audioErr.message });
            return null;
          }
        }
        return null;
      }
    },
    []
  );

  // Probe available media devices in Lobby
  const getPermissions = useCallback(async () => {
    let stream = null;
    let hasVideo = false;
    let hasAudio = false;

    try {
      stream = await acquireLocalStream(true, true);
      if (stream) {
        hasVideo = stream.getVideoTracks().length > 0;
        hasAudio = stream.getAudioTracks().length > 0;
        localStreamRef.current = stream;
        if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
          localVideoRef.current.srcObject = stream;
        }
      }
    } catch (_) {}

    setVideoAvailable(hasVideo);
    setAudioAvailable(hasAudio);
    setScreenAvailable(!!navigator.mediaDevices?.getDisplayMedia);
  }, [acquireLocalStream]);

  useEffect(() => {
    getPermissions();
    return () => {
      // Cleanup all media resources on unmount
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      Object.values(connectionsRef.current).forEach((pc) => {
        try { pc.close(); } catch (_) {}
      });
      connectionsRef.current = {};
      iceCandidateQueueRef.current = {};
      if (socketRef.current) {
        socketRef.current.emit("leave-call");
        socketRef.current.disconnect();
      }
      if (audioMeterContextRef.current) {
        safeCloseAudioContext(audioMeterContextRef.current);
        audioMeterContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio Speaking Activity Meter ─────────────────────────────────────────
  useEffect(() => {
    if (askForUsername || !localStreamRef.current) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    let isCancelled = false;
    let ctx = null;

    try {
      ctx = new AudioCtx();
      audioMeterContextRef.current = ctx;
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (!audioTrack) return;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        if (isCancelled) return;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        const speakingNow = avg > 22 && micEnabled;

        setIsSpeakingLocal((prev) => {
          if (prev !== speakingNow && socketRef.current?.connected) {
            socketRef.current.emit("media-state", { isSpeaking: speakingNow });
          }
          return speakingNow;
        });

        requestAnimationFrame(checkAudio);
      };

      checkAudio();
    } catch (_) {}

    return () => {
      isCancelled = true;
      if (ctx) {
        safeCloseAudioContext(ctx);
        if (audioMeterContextRef.current === ctx) {
          audioMeterContextRef.current = null;
        }
      }
    };
  }, [askForUsername, micEnabled]);

// Helpers for retrieving dedicated video senders per peer connection
const getCameraSender = (pc) => {
  if (!pc) return null;
  const videoTransceivers = pc
    .getTransceivers()
    .filter((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");
  return videoTransceivers[0]?.sender || null;
};

const getScreenSender = (pc) => {
  if (!pc) return null;
  const videoTransceivers = pc
    .getTransceivers()
    .filter((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");
  return videoTransceivers[1]?.sender || null;
};

  // ── Peer Connection Creation ───────────────────────────────────────────────
  const createPeerConnection = useCallback((remoteSocketId) => {
    const existing = connectionsRef.current[remoteSocketId];
    if (isConnectionAlive(existing)) {
      return existing;
    }

    rtcLog.info("pc_create", { remoteSocketId });
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit(
          "signal",
          remoteSocketId,
          JSON.stringify({ ice: event.candidate })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setParticipants((prev) => {
        if (!prev[remoteSocketId]) return prev;
        return {
          ...prev,
          [remoteSocketId]: { ...prev[remoteSocketId], connectionStatus: state },
        };
      });

      if (state === "failed" && socketRef.current?.connected) {
        try { pc.restartIce(); } catch (_) {}
      }
    };

    pc.ontrack = (event) => {
      const { track, transceiver } = event;
      let inboundStream = event.streams[0];
      if (!inboundStream) {
        inboundStream = new MediaStream();
        inboundStream.addTrack(track);
      }

      const videoTransceivers = pc
        .getTransceivers()
        .filter((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");
      const isScreen = Boolean(videoTransceivers[1] && transceiver === videoTransceivers[1]);

      event.track.onunmute = () => {
        setParticipants((prev) => {
          if (!prev[remoteSocketId]) return prev;
          return { ...prev, [remoteSocketId]: { ...prev[remoteSocketId] } };
        });
      };

      setParticipants((prev) => {
        const current = prev[remoteSocketId] || {
          socketId: remoteSocketId,
          username: `Participant (${remoteSocketId.slice(0, 5)})`,
          isGuest: true,
          mediaState: { camera: true, mic: true, screenSharing: false, isSpeaking: false },
        };

        if (track.kind === "video") {
          if (isScreen) {
            return {
              ...prev,
              [remoteSocketId]: {
                ...current,
                screenStream: inboundStream,
                connectionStatus: "connected",
              },
            };
          } else {
            return {
              ...prev,
              [remoteSocketId]: {
                ...current,
                cameraStream: inboundStream,
                stream: inboundStream,
                connectionStatus: "connected",
              },
            };
          }
        }

        // Audio track
        return {
          ...prev,
          [remoteSocketId]: {
            ...current,
            audioStream: inboundStream,
            connectionStatus: "connected",
          },
        };
      });
    };

    // Attach local audio & camera tracks
    const localStream = localStreamRef.current || createBlackSilenceStream();
    if (!localStreamRef.current) localStreamRef.current = localStream;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      pc.addTrack(audioTrack, localStream);
    } else {
      try { pc.addTransceiver("audio", { direction: "sendrecv" }); } catch (_) {}
    }

    const cameraTrack = localStream.getVideoTracks()[0];
    if (cameraTrack) {
      pc.addTrack(cameraTrack, localStream);
    } else {
      try { pc.addTransceiver("video", { direction: "sendrecv" }); } catch (_) {}
    }

    // Attach dedicated screen-share transceiver (2nd video transceiver)
    const existingVideoTransceivers = pc
      .getTransceivers()
      .filter((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");

    if (existingVideoTransceivers.length < 2) {
      try {
        const screenTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
        if (isScreenSharingRef.current && screenStreamRef.current) {
          const screenTrack = screenStreamRef.current.getVideoTracks()[0];
          if (screenTrack) {
            screenTransceiver.sender.replaceTrack(screenTrack).catch(() => {});
          }
        }
      } catch (_) {}
    } else if (isScreenSharingRef.current && screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      if (screenTrack && existingVideoTransceivers[1]?.sender) {
        existingVideoTransceivers[1].sender.replaceTrack(screenTrack).catch(() => {});
      }
    }

    connectionsRef.current[remoteSocketId] = pc;
    return pc;
  }, []);

  // ── Signaling Message Handler ─────────────────────────────────────────────
  const gotMessageFromServer = useCallback(
    (fromId, messageStr) => {
      if (fromId === socketIdRef.current) return;

      const signal = (() => {
        try { return JSON.parse(messageStr); } catch { return null; }
      })();
      if (!signal) return;

      const pc = createPeerConnection(fromId);

      if (signal.sdp) {
        pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(async () => {
            // Drain any queued ICE candidates for this peer
            const queued = iceCandidateQueueRef.current[fromId];
            if (queued && queued.length > 0) {
              delete iceCandidateQueueRef.current[fromId];
              for (const cand of queued) {
                try {
                  await pc.addIceCandidate(cand);
                } catch (e) {
                  rtcLog.warn("drain_ice_candidate_error", { fromId, error: e.message });
                }
              }
            }

            if (signal.sdp.type === "offer") {
              const desc = await pc.createAnswer();
              await pc.setLocalDescription(desc);
              socketRef.current?.emit(
                "signal",
                fromId,
                JSON.stringify({ sdp: pc.localDescription })
              );
            }
          })
          .catch((e) => rtcLog.error("sdp_error", { fromId, error: e.message }));
      }

      if (signal.ice) {
        const candidate = new RTCIceCandidate(signal.ice);
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          if (!iceCandidateQueueRef.current[fromId]) {
            iceCandidateQueueRef.current[fromId] = [];
          }
          iceCandidateQueueRef.current[fromId].push(candidate);
        } else {
          pc.addIceCandidate(candidate).catch((e) =>
            rtcLog.warn("ice_candidate_error", { fromId, error: e.message })
          );
        }
      }
    },
    [createPeerConnection]
  );

  // ── Socket Connection & Room Lifecycle ────────────────────────────────────
  const connectToSocketServer = useCallback(() => {
    socketRef.current = io.connect(SERVER_URL);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      setSocketStatus("connected");
      rtcLog.info("socket_connected", { socketId: socketRef.current.id });

      const userMetadata = {
        username: username || userData?.name || "Participant",
        userId: userData?.id || userData?._id || null,
        isGuest: !userData?.name,
        mediaState: { camera: cameraEnabled, mic: micEnabled, screenSharing: false },
      };

      socketRef.current.emit("join-call", cleanRoomCode, userMetadata);
    });

    socketRef.current.on("reconnect", () => {
      setSocketStatus("connected");
      const userMetadata = {
        username: username || userData?.name || "Participant",
        userId: userData?.id || userData?._id || null,
        isGuest: !userData?.name,
        mediaState: { camera: cameraEnabled, mic: micEnabled, screenSharing: false },
      };
      socketRef.current.emit("join-call", cleanRoomCode, userMetadata);
    });

    socketRef.current.on("disconnect", () => setSocketStatus("reconnecting"));

    socketRef.current.on("room-participants", (allMeta) => {
      setParticipants((prev) => {
        const merged = { ...prev };
        for (const [id, meta] of Object.entries(allMeta)) {
          if (id !== socketIdRef.current) {
            merged[id] = {
              ...(merged[id] || {}),
              ...meta,
              connectionStatus: merged[id]?.connectionStatus || "connecting",
            };
          }
        }
        return merged;
      });
    });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("media-state-changed", (senderId, state) => {
      setParticipants((prev) => {
        if (!prev[senderId]) return prev;
        return {
          ...prev,
          [senderId]: {
            ...prev[senderId],
            mediaState: { ...prev[senderId].mediaState, ...state },
          },
        };
      });
    });

    socketRef.current.on("chat-message", (data, sender, senderSocketId, msgId) => {
      const stableId = msgId || `${Date.now()}-${senderSocketId}-${Math.random()}`;
      setMessages((prev) => {
        if (prev.some((m) => m.id === stableId)) return prev;
        return [...prev, { id: stableId, sender, data }];
      });

      // [ISSUE 6] Toast notification and chime when chat is closed
      if (senderSocketId !== socketIdRef.current) {
        if (!showModal) {
          setNewMessages((n) => n + 1);
          playChatChime();
          setChatToast({ id: stableId, sender, data });
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => setChatToast(null), 4500);
        }
      }
    });

    socketRef.current.on("user-joined", (joiningId, clients, meta) => {
      if (meta && joiningId !== socketIdRef.current) {
        setParticipants((prev) => ({
          ...prev,
          [joiningId]: {
            ...(prev[joiningId] || {}),
            ...meta,
            connectionStatus: "connecting",
          },
        }));
      }

      clients.forEach((clientSocketId) => {
        if (clientSocketId === socketIdRef.current) return;
        createPeerConnection(clientSocketId);
      });

      if (joiningId === socketIdRef.current) {
        Object.entries(connectionsRef.current).forEach(([peerId, pc]) => {
          if (peerId === socketIdRef.current || !isConnectionAlive(pc)) return;
          pc.createOffer()
            .then((desc) => pc.setLocalDescription(desc))
            .then(() => {
              socketRef.current?.emit(
                "signal",
                peerId,
                JSON.stringify({ sdp: pc.localDescription })
              );
            })
            .catch((e) => rtcLog.error("offer_error", { peerId, error: e.message }));
        });
      }
    });

    socketRef.current.on("room-error", (err) => {
      rtcLog.error("room_error", err);
      if (err?.code === "ROOM_EXPIRED") {
        setRoomExpired(true);
        setRoomExpiredMessage(
          err.message || "This room has expired due to 15 minutes of inactivity."
        );
      }
    });

    socketRef.current.on("user-left", (id) => {
      delete iceCandidateQueueRef.current[id];
      const pc = connectionsRef.current[id];
      if (pc) {
        try { pc.close(); } catch (_) {}
        delete connectionsRef.current[id];
      }
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  }, [cleanRoomCode, username, userData, cameraEnabled, micEnabled, showModal, gotMessageFromServer, createPeerConnection]);

  // Connect flow
  const connect = useCallback(() => {
    if (!username.trim()) return;
    setAskForUsername(false);
    connectToSocketServer();
  }, [username, connectToSocketServer]);

  // ── Camera Toggle ──────────────────────────────────────────────────────────
  const handleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    const videoTrack = stream?.getVideoTracks()[0];

    if (!videoTrack || videoTrack.readyState === "ended") {
      const newStream = await acquireLocalStream(true, false);
      if (!newStream) return;
      const newTrack = newStream.getVideoTracks()[0];

      Object.values(connectionsRef.current).forEach((pc) => {
        const sender = getCameraSender(pc);
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });

      if (stream) {
        const oldTrack = stream.getVideoTracks()[0];
        if (oldTrack) stream.removeTrack(oldTrack);
        stream.addTrack(newTrack);
      }
      setCameraEnabled(true);
      socketRef.current?.emit("media-state", { camera: true });
      return;
    }

    const nextState = !videoTrack.enabled;
    videoTrack.enabled = nextState;
    setCameraEnabled(nextState);
    socketRef.current?.emit("media-state", { camera: nextState });
  }, [acquireLocalStream]);

  // ── Mic Toggle ─────────────────────────────────────────────────────────────
  const handleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    const audioTrack = stream?.getAudioTracks()[0];
    if (!audioTrack) return;
    const nextState = !audioTrack.enabled;
    audioTrack.enabled = nextState;
    setMicEnabled(nextState);
    socketRef.current?.emit("media-state", { mic: nextState });
  }, []);

  // ── Device Selection & Live Switching (Issue 5) ───────────────────────────
  const handleSelectCamera = useCallback(
    async (deviceId) => {
      activeCameraIdRef.current = deviceId;
      try {
        const newStream = await acquireLocalStream(true, false, deviceId);
        if (!newStream) return;
        const newTrack = newStream.getVideoTracks()[0];

        Object.values(connectionsRef.current).forEach((pc) => {
          const sender = getCameraSender(pc);
          if (sender) sender.replaceTrack(newTrack).catch(() => {});
        });

        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            oldTrack.stop();
            localStreamRef.current.removeTrack(oldTrack);
          }
          localStreamRef.current.addTrack(newTrack);
          if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }
      } catch (err) {
        rtcLog.error("camera_switch_failed", { error: err.message });
      }
    },
    [acquireLocalStream]
  );

  const handleSelectMic = useCallback(
    async (deviceId) => {
      activeMicIdRef.current = deviceId;
      try {
        const newStream = await acquireLocalStream(false, true, null, deviceId);
        if (!newStream) return;
        const newTrack = newStream.getAudioTracks()[0];

        Object.values(connectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) sender.replaceTrack(newTrack).catch(() => {});
        });

        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldTrack) {
            oldTrack.stop();
            localStreamRef.current.removeTrack(oldTrack);
          }
          localStreamRef.current.addTrack(newTrack);
        }
      } catch (err) {
        rtcLog.error("mic_switch_failed", { error: err.message });
      }
    },
    [acquireLocalStream]
  );

  const startScreenShare = useCallback(async () => {
    let screenStream = null;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true,
      });
    } catch (err) {
      // NotAllowedError = user cancelled/denied — do not retry
      if (err.name === "NotAllowedError" || err.name === "NotFoundError" || err.name === "AbortError") {
        rtcLog.warn("screen_share_cancelled", { name: err.name });
        return;
      }
      // Only retry without audio for capability errors (e.g. audio not supported)
      rtcLog.warn("display_media_audio_fallback", { error: err.message });
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } catch (e2) {
        rtcLog.warn("screen_share_cancelled", { name: e2.name });
        return;
      }
    }

    const screenTrack = screenStream?.getVideoTracks()[0];
    if (!screenTrack) return;

    screenStreamRef.current = screenStream;

    // Attach screen track to dedicated screen sender on all peer connections
    Object.values(connectionsRef.current).forEach((pc) => {
      const screenSender = getScreenSender(pc);
      if (screenSender) screenSender.replaceTrack(screenTrack).catch(() => {});
    });

    // Show screen in the dedicated preview element (main stage)
    if (screenPreviewVideoRef.current) {
      screenPreviewVideoRef.current.srcObject = screenStream;
    }

    isScreenSharingRef.current = true;
    setScreenSharing(true);
    socketRef.current?.emit("media-state", { screenSharing: true });

    screenTrack.onended = () => {
      stopScreenShareRef.current?.();
    };
  }, []);

  const stopScreenShare = useCallback(
    async () => {
      if (!isScreenSharingRef.current && !screenStreamRef.current) return;
      isScreenSharingRef.current = false;
      setScreenSharing(false);

      // Stop the screen track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (screenPreviewVideoRef.current) {
        screenPreviewVideoRef.current.srcObject = null;
      }

      // Detach screen track from dedicated screen sender on all peer connections
      Object.values(connectionsRef.current).forEach((pc) => {
        const screenSender = getScreenSender(pc);
        if (screenSender) screenSender.replaceTrack(null).catch(() => {});
      });

      socketRef.current?.emit("media-state", { screenSharing: false });
    },
    []
  );

  stopScreenShareRef.current = stopScreenShare;

  const handleScreen = useCallback(() => {
    if (isScreenSharingRef.current) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

  // ── [ISSUE 8] Copy Room Code Only ─────────────────────────────────────────
  const copyRoomCode = useCallback(async () => {
    const success = await copyToClipboard(cleanRoomCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [cleanRoomCode]);

  // ── Chat Messaging with Emoji Parsing ─────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!message.trim() || !socketRef.current) return;
    const parsedText = parseEmojiShortcodes(message.trim());
    const stableId = `${Date.now()}-${socketIdRef.current}-${Math.random().toString(36).slice(2, 6)}`;
    socketRef.current.emit("chat-message", parsedText, username || "Participant", stableId);
    setMessage("");
  }, [message, username]);

  const handleEndCall = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    Object.values(connectionsRef.current).forEach((pc) => {
      try { pc.close(); } catch (_) {}
    });
    connectionsRef.current = {};
    if (socketRef.current) {
      socketRef.current.emit("leave-call");
      socketRef.current.disconnect();
    }
    navigate("/home");
  }, [navigate]);

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

  const participantList = Object.values(participants);
  const remotePresenter = participantList.find((p) => p.mediaState?.screenSharing);
  const isPresentationActive = Boolean(screenSharing || remotePresenter);
  const isSelfPresenting = Boolean(screenSharing);
  const totalInCall = 1 + participantList.length;
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

          <main className={styles.lobbyMain} style={{ display: "flex", justifyContent: "center" }}>
            <div className={styles.joinCard} style={{ maxWidth: 460, textAlign: "center" }}>
              <div
                className={styles.waitingIconPulse}
                style={{
                  margin: "0 auto 18px",
                  background: "rgba(255, 92, 92, 0.12)",
                  borderColor: "rgba(255, 92, 92, 0.3)",
                }}
              >
                <TimerOffIcon style={{ fontSize: 32, color: "var(--danger, #FF5C5C)" }} />
              </div>
              <h1 className={styles.cardHeading} style={{ color: "var(--danger, #FF5C5C)" }}>
                Meeting Expired
              </h1>
              <p className={styles.cardSubtext} style={{ marginBottom: 24 }}>
                {roomExpiredMessage || "This meeting room has expired due to 15 minutes of inactivity."}
              </p>
              <button
                type="button"
                className={styles.chatSendBtn}
                onClick={() => navigate("/home")}
                style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: 700 }}
              >
                Return to Home
              </button>
            </div>
          </main>
        </div>
      ) : (
        <>
          {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        activeCameraId={activeCameraIdRef.current}
        activeMicId={activeMicIdRef.current}
        onSelectCamera={handleSelectCamera}
        onSelectMic={handleSelectMic}
        activeStream={localStreamRef.current}
      />

      {/* Floating Chat Toast Notification (Issue 6) */}
      {chatToast && !showModal && (
        <div
          className={styles.chatToast}
          onClick={() => {
            setModal(true);
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

      {askForUsername ? (
        /* ── LOBBY / PRE-CHECK SCREEN ───────────────────────────────────── */
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
                ref={bindLocalVideo}
                autoPlay
                muted
                playsInline
                className={styles.previewVideo}
                style={{ display: videoAvailable && cameraEnabled ? "block" : "none" }}
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
                  className={`${styles.controlCircleBtn} ${!cameraEnabled ? styles.controlCircleBtnOff : ""}`}
                  onClick={() => setCameraEnabled((v) => !v)}
                  title="Toggle Camera"
                  disabled={!videoAvailable}
                >
                  {cameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                </button>
                <button
                  type="button"
                  className={`${styles.controlCircleBtn} ${!micEnabled ? styles.controlCircleBtnOff : ""}`}
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
                    if (e.key === "Enter") connect();
                  }}
                  required
                />
              </div>

              <button
                type="button"
                className={styles.chatSendBtn}
                onClick={connect}
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
                🔒 <span>WebRTC Peer-to-Peer Encrypted Audio/Video</span>
              </div>
            </div>
          </main>
        </div>
      ) : (
        /* ── IN-CALL MEETING VIEWPORT (Issue 2) ─────────────────────────── */
        <div className={styles.meetVideoContainer}>
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
                  <ContentCopyIcon style={{ fontSize: 13, marginRight: 4, verticalAlign: "middle" }} />
                  {copied ? "Code Copied!" : "Copy Code"}
                </button>
              </div>

              {/* [ISSUE 9] Interactive Participants Count Badge */}
              <div
                className={styles.callTimerBadge}
                onClick={toggleParticipants}
                style={{ cursor: "pointer" }}
                title="View Participants"
              >
                <PeopleIcon style={{ fontSize: 14 }} />
                <span>{1 + participantList.length} in call</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
              <NetworkStatusBadge connectionsRef={connectionsRef} />
              <div className={styles.callTimerBadge}>
                {socketStatus === "reconnecting" && (
                  <span style={{ color: "#F5C451", marginRight: 8 }}>⚠ Reconnecting…</span>
                )}
                <span>Elapsed:</span>
                <strong className="tabular-nums">{formatDuration(elapsedSeconds)}</strong>
              </div>
            </div>
          </header>

          {/* Stage Area: Flex layout containing video grid + active side panels */}
          <div className={styles.stageArea}>
            <div className={styles.mainMediaViewport}>
              {isPresentationActive ? (
                /* ── Presentation Mode: Main Stage + Sharer PiP + Bottom Participant Strip ── */
                <div className={styles.presentationContainer}>
                  <div className={styles.presentationStage}>
                    <div className={styles.presentationHeader}>
                      <ScreenShareIcon style={{ fontSize: 16, color: "var(--accent, #FF7A59)" }} />
                      <span>
                        Screen Shared by <strong>{isSelfPresenting ? `You (${username || "Me"})` : (remotePresenter?.username || "Participant")}</strong>
                      </span>
                    </div>

                    <div className={styles.presentationVideoWrapper}>
                      {isSelfPresenting ? (
                        <video
                          ref={bindScreenPreview}
                          autoPlay
                          muted
                          playsInline
                        />
                      ) : (
                        <video
                          data-socket={remotePresenter?.socketId}
                          ref={bindRemoteVideo(remotePresenter?.screenStream || remotePresenter?.stream)}
                          autoPlay
                          playsInline
                        />
                      )}
                    </div>

                    {/* Presenter Camera PiP inside Stage */}
                    <div className={styles.presenterPipTile}>
                      {isSelfPresenting ? (
                        cameraEnabled ? (
                          <video ref={bindLocalVideo} autoPlay muted playsInline style={{ transform: "scaleX(-1)" }} />
                        ) : (
                          <div className={styles.avatarPlaceholderTile}>
                            <div className={styles.avatarInitialCircle} style={{ width: 44, height: 44, fontSize: 16 }}>
                              {getUserInitials(username || userData?.name)}
                            </div>
                          </div>
                        )
                      ) : remotePresenter?.mediaState?.camera !== false && (remotePresenter?.cameraStream || remotePresenter?.stream) ? (
                        <video
                          data-socket={remotePresenter?.socketId}
                          ref={bindRemoteVideo(remotePresenter?.cameraStream || remotePresenter?.stream)}
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <div className={styles.avatarPlaceholderTile}>
                          <div className={styles.avatarInitialCircle} style={{ width: 44, height: 44, fontSize: 16 }}>
                            {getUserInitials(remotePresenter?.username || "Presenter")}
                          </div>
                        </div>
                      )}
                      <div className={styles.localUserTag}>
                        {isSelfPresenting ? `You (${username || "Me"})` : (remotePresenter?.username || "Presenter")}
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Participant Strip */}
                  <div className={styles.presentationStrip}>
                    {/* If local user is spectator, show local user in strip */}
                    {!isSelfPresenting && (
                      <div className={`${styles.stripTile} ${isSpeakingLocal ? styles.speakingRowGlow : ""}`}>
                        {cameraEnabled ? (
                          <video ref={bindLocalVideo} autoPlay muted playsInline style={{ transform: "scaleX(-1)" }} />
                        ) : (
                          <div className={styles.avatarPlaceholderTile}>
                            <div className={styles.avatarInitialCircle} style={{ width: 36, height: 36, fontSize: 13 }}>
                              {getUserInitials(username || userData?.name)}
                            </div>
                          </div>
                        )}
                        <div className={styles.participantLabelOverlay}>
                          <span>You ({username || "Me"})</span>
                          {!micEnabled && (
                            <MicOffIcon style={{ fontSize: 11, color: "var(--danger, #FF5C5C)" }} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* All other participants in strip (except remote presenter) */}
                    {participantList
                      .filter((p) => p.socketId !== remotePresenter?.socketId)
                      .map((peer) => {
                        const camOn = peer.mediaState?.camera ?? true;
                        const speaking = peer.mediaState?.isSpeaking ?? false;
                        const micOn = peer.mediaState?.mic ?? true;

                        return (
                          <div
                            key={peer.socketId}
                            className={`${styles.stripTile} ${speaking ? styles.speakingRowGlow : ""}`}
                          >
                            {camOn ? (
                              <video
                                data-socket={peer.socketId}
                                ref={bindRemoteVideo(peer.cameraStream || peer.stream)}
                                autoPlay
                                playsInline
                              />
                            ) : (
                              <div className={styles.avatarPlaceholderTile}>
                                <div className={styles.avatarInitialCircle} style={{ width: 36, height: 36, fontSize: 13 }}>
                                  {getUserInitials(peer.username)}
                                </div>
                              </div>
                            )}
                            <div className={styles.participantLabelOverlay}>
                              <span>{peer.username || `Participant (${peer.socketId?.slice(0, 5) ?? "?????"})`}</span>
                              {!micOn && (
                                <MicOffIcon style={{ fontSize: 11, color: "var(--danger, #FF5C5C)" }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                /* ── Gallery Mode: Responsive Balanced Grids (1x1, 2x1, 2x2, 3x2) ── */
                <div className={styles.galleryContainer}>
                  {participantList.length === 0 ? (
                    <div className={styles.soloWaitingContainer}>
                      <div className={styles.soloPreviewCard}>
                        {cameraEnabled ? (
                          <video
                            ref={bindLocalVideo}
                            autoPlay
                            muted
                            playsInline
                            style={{ transform: "scaleX(-1)" }}
                          />
                        ) : (
                          <div className={styles.avatarPlaceholderTile}>
                            <div
                              className={`${styles.avatarInitialCircle} ${
                                isSpeakingLocal ? styles.speakingRingOuter : ""
                              }`}
                            >
                              {getUserInitials(username || userData?.name)}
                            </div>
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
                        Share this room code <strong>{cleanRoomCode}</strong> with others to start conversing.
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
                    <div className={`${styles.galleryGrid} ${galleryGridClass}`}>
                      {/* Local User Tile in Gallery Grid */}
                      <div
                        className={`${styles.videoWrapper} ${
                          isSpeakingLocal ? styles.speakingRowGlow : ""
                        }`}
                      >
                        {cameraEnabled ? (
                          <video
                            ref={bindLocalVideo}
                            autoPlay
                            muted
                            playsInline
                            style={{ transform: "scaleX(-1)" }}
                          />
                        ) : (
                          <div className={styles.avatarPlaceholderTile}>
                            <div
                              className={`${styles.avatarInitialCircle} ${
                                isSpeakingLocal ? styles.speakingRingOuter : ""
                              }`}
                            >
                              {getUserInitials(username || userData?.name)}
                            </div>
                            <span className={styles.avatarPlaceholderName}>
                              {username || "You"}
                            </span>
                          </div>
                        )}
                        <div className={styles.participantLabelOverlay}>
                          <span>You ({username || "Me"})</span>
                          {!micEnabled && (
                            <MicOffIcon style={{ fontSize: 13, color: "var(--danger, #FF5C5C)" }} />
                          )}
                        </div>
                      </div>

                      {/* Remote Participants in Gallery Grid */}
                      {participantList.map((peer) => {
                        const camOn = peer.mediaState?.camera ?? true;
                        const speaking = peer.mediaState?.isSpeaking ?? false;
                        const micOn = peer.mediaState?.mic ?? true;

                        return (
                          <div
                            key={peer.socketId}
                            className={`${styles.videoWrapper} ${
                              speaking ? styles.speakingRowGlow : ""
                            }`}
                          >
                            {camOn ? (
                              <video
                                data-socket={peer.socketId}
                                ref={bindRemoteVideo(peer.cameraStream || peer.stream)}
                                autoPlay
                                playsInline
                              />
                            ) : (
                              <div className={styles.avatarPlaceholderTile}>
                                <div
                                  className={`${styles.avatarInitialCircle} ${
                                    speaking ? styles.speakingRingOuter : ""
                                  }`}
                                >
                                  {getUserInitials(peer.username)}
                                </div>
                                <span className={styles.avatarPlaceholderName}>
                                  {peer.username || "Participant"}
                                </span>
                              </div>
                            )}

                            <div className={styles.participantLabelOverlay}>
                              <span>
                                {peer.username ||
                                  `Participant (${peer.socketId?.slice(0, 5) ?? "?????"})`}
                              </span>
                              {!micOn && (
                                <MicOffIcon style={{ fontSize: 13, color: "var(--danger, #FF5C5C)" }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Participants Panel (Issue 9) */}
            <ParticipantsPanel
              isOpen={showParticipants}
              onClose={() => setShowParticipants(false)}
              participants={participantList}
              localParticipant={{
                username: username || "You",
                isGuest: !userData?.name,
                camera: cameraEnabled,
                mic: micEnabled,
                screenSharing,
                isSpeaking: isSpeakingLocal,
                connectionStatus: "connected",
              }}
            />

            {/* In-Call Messages Side Panel (Issue 6) */}
            {showModal && (
              <aside className={styles.sidePanelContainer} aria-label="In-Call Chat">
                <div className={styles.chatContainer}>
                  <div className={styles.sidePanelHeader}>
                    <h2 className={styles.chatHeaderTitle}>In-Call Messages</h2>
                    <button
                      type="button"
                      className={styles.closeChatBtn}
                      onClick={() => setModal(false)}
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
                            className={`${styles.chatMsgBubble} ${isSelf ? styles.chatMsgSelf : ""}`}
                            key={item.id}
                          >
                            <div className={styles.chatSender}>{item.sender}</div>
                            <div className={styles.chatText}>{item.data}</div>
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
                        }}
                      >
                        No messages yet. Send a greeting!
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
                        if (e.key === "Enter") sendMessage();
                      }}
                    />
                    <button
                      type="button"
                      className={styles.chatSendBtn}
                      onClick={sendMessage}
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
              className={`${styles.actionCircleBtn} ${!cameraEnabled ? styles.controlCircleBtnOff : ""}`}
              onClick={handleVideo}
              title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
            >
              {cameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
            </button>

            <button
              type="button"
              className={`${styles.actionCircleBtn} ${!micEnabled ? styles.controlCircleBtnOff : ""}`}
              onClick={handleAudio}
              title={micEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {micEnabled ? <MicIcon /> : <MicOffIcon />}
            </button>

            {screenAvailable && (
              <button
                type="button"
                className={`${styles.actionCircleBtn} ${screenSharing ? styles.controlCircleBtnOff : ""}`}
                onClick={handleScreen}
                title={screenSharing ? "Stop sharing screen" : "Share screen"}
              >
                {screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </button>
            )}

            <button
              type="button"
              className={`${styles.actionCircleBtn} ${showParticipants ? styles.controlCircleBtnOff : ""}`}
              onClick={toggleParticipants}
              title="Participants list"
            >
              <PeopleIcon />
            </button>

            <button
              type="button"
              className={`${styles.actionCircleBtn} ${showModal ? styles.controlCircleBtnOff : ""}`}
              onClick={toggleChat}
              title="Toggle chat"
              style={{ position: "relative" }}
            >
              <ChatIcon />
              {newMessages > 0 && <span className={styles.badgeUnread}>{newMessages}</span>}
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
              onClick={handleEndCall}
              title="Leave Call"
            >
              <CallEndIcon />
            </button>
          </nav>
        </div>
      )}
        </>
      )}
    </div>
  );
}
