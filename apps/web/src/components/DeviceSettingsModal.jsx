import React, { useEffect, useRef, useState, useCallback } from "react";
import CloseIcon from "@mui/icons-material/Close";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import styles from "../styles/videoComponent.module.css";
import { safeCloseAudioContext, createSafeAudioContext } from "../utils/audioUtils";

export default function DeviceSettingsModal({
  isOpen,
  onClose,
  activeCameraId,
  activeMicId,
  onSelectCamera,
  onSelectMic,
  activeStream,
}) {
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(activeCameraId || "");
  const [selectedMic, setSelectedMic] = useState(activeMicId || "");
  const [selectedSpeaker, setSelectedSpeaker] = useState(
    localStorage.getItem("sangam_speaker_id") || ""
  );
  const [backgroundEffect, setBackgroundEffect] = useState(
    () => (typeof localStorage !== "undefined" ? localStorage.getItem("sangam_background_effect") || "none" : "none")
  );
  const [noiseSuppression, setNoiseSuppression] = useState(
    () => (typeof localStorage !== "undefined" ? localStorage.getItem("sangam_noise_suppression") !== "false" : true)
  );
  const [micLevel, setMicLevel] = useState(0);
  const [supportsSinkId, setSupportsSinkId] = useState(false);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  const [deviceError, setDeviceError] = useState("");

  const previewVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);
  const localPreviewStreamRef = useRef(null);

  // Check sinkId support
  useEffect(() => {
    if (typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype) {
      setSupportsSinkId(true);
    }
  }, []);

  // Enumerate devices
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

      setCameras(videoInputs);
      setMicrophones(audioInputs);
      setSpeakers(audioOutputs);

      if (!selectedCamera && videoInputs.length > 0) {
        const storedCam = localStorage.getItem("sangam_camera_id");
        const found = videoInputs.find((c) => c.deviceId === storedCam);
        setSelectedCamera(found ? found.deviceId : videoInputs[0].deviceId);
      }
      if (!selectedMic && audioInputs.length > 0) {
        const storedMic = localStorage.getItem("sangam_mic_id");
        const found = audioInputs.find((m) => m.deviceId === storedMic);
        setSelectedMic(found ? found.deviceId : audioInputs[0].deviceId);
      }
      if (!selectedSpeaker && audioOutputs.length > 0) {
        const storedSpeaker = localStorage.getItem("sangam_speaker_id");
        const found = audioOutputs.find((s) => s.deviceId === storedSpeaker);
        setSelectedSpeaker(found ? found.deviceId : audioOutputs[0].deviceId);
      }
    } catch (err) {
      setDeviceError("Unable to enumerate devices: " + (err.message || "Unknown error"));
    }
  }, [selectedCamera, selectedMic, selectedSpeaker]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    refreshDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      };
    }
  }, [isOpen, refreshDevices]);

  // Camera preview in modal
  useEffect(() => {
    if (!isOpen) {
      if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        localPreviewStreamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    const startPreview = async () => {
      try {
        if (localPreviewStreamRef.current) {
          localPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const constraints = {
          video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localPreviewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (isMounted) {
          setDeviceError("Camera preview error: " + (err.message || "Unavailable"));
        }
      }
    };

    startPreview();

    return () => {
      isMounted = false;
      if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        localPreviewStreamRef.current = null;
      }
    };
  }, [isOpen, selectedCamera]);

  // Audio level meter
  useEffect(() => {
    if (!isOpen) {
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        audioContextRef.current = null;
        safeCloseAudioContext(ctx);
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setMicLevel(0);
      return;
    }

    let audioStream = null;
    let isCancelled = false;

    const setupMeter = async () => {
      try {
        const stream = activeStream?.getAudioTracks().length > 0
          ? activeStream
          : await navigator.mediaDevices.getUserMedia({
              audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
              video: false,
            });

        if (isCancelled) {
          if (stream !== activeStream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (stream !== activeStream) {
          audioStream = stream;
        }

        const ctx = createSafeAudioContext();
        if (!ctx) return;
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale from 0 to 100
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setMicLevel(level);
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (_) {
        // Microphone access denied or in use
      }
    };

    setupMeter();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        audioContextRef.current = null;
        safeCloseAudioContext(ctx);
      }
      if (audioStream) {
        audioStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, selectedMic, activeStream]);

  // Play test sound
  const playTestSpeaker = () => {
    try {
      const ctx = createSafeAudioContext();
      if (!ctx) return;
      setIsPlayingTestSound(true);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3); // G5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      setTimeout(() => {
        setIsPlayingTestSound(false);
        safeCloseAudioContext(ctx);
      }, 700);
    } catch (_) {
      setIsPlayingTestSound(false);
    }
  };

  const handleApply = () => {
    if (selectedCamera) {
      localStorage.setItem("sangam_camera_id", selectedCamera);
      onSelectCamera?.(selectedCamera);
    }
    if (selectedMic) {
      localStorage.setItem("sangam_mic_id", selectedMic);
      onSelectMic?.(selectedMic);
    }
    if (selectedSpeaker) {
      localStorage.setItem("sangam_speaker_id", selectedSpeaker);
    }
    localStorage.setItem("sangam_background_effect", backgroundEffect);
    localStorage.setItem("sangam_noise_suppression", noiseSuppression ? "true" : "false");
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Audio & Video Settings</h2>
          <button type="button" className={styles.closeChatBtn} onClick={onClose} title="Close settings">
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {deviceError && (
          <div className={styles.settingsAlert}>
            <span>⚠️ {deviceError}</span>
          </div>
        )}

        <div className={styles.modalBody}>
          {/* Camera Selection */}
          <div className={styles.settingsSection}>
            <label className={styles.settingsLabel}>
              <VideocamIcon style={{ fontSize: 18 }} />
              <span>Camera</span>
            </label>
            <select
              className={styles.settingsSelect}
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
            >
              {cameras.length === 0 ? (
                <option value="">No cameras detected</option>
              ) : (
                cameras.map((c, i) => (
                  <option key={c.deviceId || i} value={c.deviceId}>
                    {c.label || `Camera ${i + 1}`}
                  </option>
                ))
              )}
            </select>

            <div className={styles.settingsPreviewBox}>
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                aria-label="Camera preview"
                className={styles.settingsPreviewVideo}
              />
            </div>
          </div>

          {/* Microphone Selection */}
          <div className={styles.settingsSection}>
            <label className={styles.settingsLabel}>
              <MicIcon style={{ fontSize: 18 }} />
              <span>Microphone</span>
            </label>
            <select
              className={styles.settingsSelect}
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
            >
              {microphones.length === 0 ? (
                <option value="">No microphones detected</option>
              ) : (
                microphones.map((m, i) => (
                  <option key={m.deviceId || i} value={m.deviceId}>
                    {m.label || `Microphone ${i + 1}`}
                  </option>
                ))
              )}
            </select>

            <div className={styles.levelMeterWrapper}>
              <span className={styles.levelMeterText}>Input Level:</span>
              <div className={styles.levelMeterTrack}>
                <div
                  className={styles.levelMeterFill}
                  style={{
                    width: `${micLevel}%`,
                    background:
                      micLevel > 75
                        ? "var(--danger, #FF5C5C)"
                        : micLevel > 40
                        ? "var(--idle, #F5C451)"
                        : "var(--speaking, #5FD39A)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Speaker Selection */}
          <div className={styles.settingsSection}>
            <label className={styles.settingsLabel}>
              <VolumeUpIcon style={{ fontSize: 18 }} />
              <span>Speaker / Audio Output</span>
            </label>
            {supportsSinkId ? (
              <select
                className={styles.settingsSelect}
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
              >
                {speakers.length === 0 ? (
                  <option value="">Default Output Device</option>
                ) : (
                  speakers.map((s, i) => (
                    <option key={s.deviceId || i} value={s.deviceId}>
                      {s.label || `Speaker ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <p className={styles.settingsHelpText}>
                Your browser uses the system default audio output.
              </p>
            )}

            <button
              type="button"
              className={styles.testSoundBtn}
              onClick={playTestSpeaker}
              disabled={isPlayingTestSound}
            >
              <VolumeUpIcon style={{ fontSize: 16 }} />
              <span>{isPlayingTestSound ? "Playing Test Chime..." : "Test Audio Output"}</span>
            </button>
          </div>

          {/* Background Effects */}
          <div className={styles.settingsSection}>
            <label className={styles.settingsLabel}>
              <VideocamIcon style={{ fontSize: 18 }} />
              <span>Visual Background Effects</span>
            </label>
            <select
              className={styles.settingsSelect}
              value={backgroundEffect}
              onChange={(e) => setBackgroundEffect(e.target.value)}
              aria-label="Visual Background Effects"
            >
              <option value="none">None (Standard Video)</option>
              <option value="blur">Background Blur</option>
              <option value="virtual-studio">Virtual Studio</option>
              <option value="virtual-office">Virtual Office</option>
            </select>
            <p className={styles.settingsHelpText}>
              Powered by LiveKit track processors and browser segmentation.
            </p>
          </div>

          {/* Noise Suppression */}
          <div className={styles.settingsSection}>
            <label className={styles.settingsLabel}>
              <MicIcon style={{ fontSize: 18 }} />
              <span>Audio Noise Suppression</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
              <input
                type="checkbox"
                id="noise-suppression-toggle"
                checked={noiseSuppression}
                onChange={(e) => setNoiseSuppression(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="noise-suppression-toggle" style={{ cursor: "pointer", fontSize: "0.88rem" }}>
                Enable AI Noise Cancellation (Krisp / WebRTC filter)
              </label>
            </div>
            <p className={styles.settingsHelpText}>
              Reduces background chatter, fan noise, and room echoes during calls.
            </p>
          </div>
        </div>


        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleApply}>
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
}
