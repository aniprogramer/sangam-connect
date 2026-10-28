/**
 * LiveKit Room options shared by web and mobile so both publish and subscribe the same way.
 * Plain objects: livekit-client only reads width/height/encoding from simulcast layers.
 */
export const ROOM_OPTIONS = Object.freeze({
  // Subscribers receive only the layer their rendered tile needs; hidden tiles are paused.
  adaptiveStream: true,
  // Publishers stop encoding layers nobody is subscribed to.
  dynacast: true,
  videoCaptureDefaults: {
    resolution: { width: 1280, height: 720, frameRate: 30 },
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    simulcast: true,
    videoCodec: "vp8",
    // Low layers below the 720p capture; 360p is the fallback for constrained viewers.
    videoSimulcastLayers: [
      { width: 320, height: 180, encoding: { maxBitrate: 160_000, maxFramerate: 15 } },
      { width: 640, height: 360, encoding: { maxBitrate: 450_000, maxFramerate: 20 } },
    ],
    // Opus DTX (silence suppression) and RED (redundant audio) where the browser supports them.
    dtx: true,
    red: true,
  },
});
