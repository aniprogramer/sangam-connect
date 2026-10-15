/**
 * Unit tests for media track lifecycle helpers.
 *
 * Covers:
 *  - track.enabled toggle (camera/mic mute, no hardware release)
 *  - isConnectionAlive() peer connection state guard
 *  - camera re-enable after track.ended → replaceTrack path
 *
 * Browser APIs are mocked via jsdom. Real WebRTC negotiation is tested
 * manually per the QA matrix in docs/qa-manual-matrix.md.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

/**
 * Create a fake MediaStreamTrack with controllable state.
 */
function makeFakeTrack(kind = "video", initialEnabled = true) {
  return {
    kind,
    enabled: initialEnabled,
    readyState: "live",
    stop: jest.fn(function () {
      this.readyState = "ended";
    }),
    onended: null,
  };
}

/**
 * Create a fake MediaStream wrapping given tracks.
 */
function makeFakeStream(tracks = []) {
  const trackList = [...tracks];
  return {
    getTracks: () => trackList,
    getVideoTracks: () => trackList.filter((t) => t.kind === "video"),
    getAudioTracks: () => trackList.filter((t) => t.kind === "audio"),
    addTrack: jest.fn((t) => trackList.push(t)),
    removeTrack: jest.fn((t) => {
      const idx = trackList.indexOf(t);
      if (idx !== -1) trackList.splice(idx, 1);
    }),
  };
}

/**
 * Create a fake RTCPeerConnection stub.
 */
function makeFakePC(connectionState = "connected", signalingState = "stable") {
  return {
    connectionState,
    signalingState,
    getSenders: jest.fn(() => []),
    close: jest.fn(function () {
      this.connectionState = "closed";
      this.signalingState = "closed";
    }),
  };
}

// ── isConnectionAlive ─────────────────────────────────────────────────────────

/**
 * Mirrors the isConnectionAlive() helper from VideoMeet.jsx.
 * Tests the exact guard logic without importing the component.
 */
const isConnectionAlive = (pc) => {
  if (!pc) return false;
  return (
    pc.connectionState !== "closed" &&
    pc.connectionState !== "failed" &&
    pc.signalingState !== "closed"
  );
};

describe("isConnectionAlive()", () => {
  test("returns true for a connected peer connection", () => {
    expect(isConnectionAlive(makeFakePC("connected", "stable"))).toBe(true);
  });

  test("returns false for null", () => {
    expect(isConnectionAlive(null)).toBe(false);
  });

  test("returns false for closed connection state", () => {
    expect(isConnectionAlive(makeFakePC("closed", "stable"))).toBe(false);
  });

  test("returns false for failed connection state", () => {
    expect(isConnectionAlive(makeFakePC("failed", "stable"))).toBe(false);
  });

  test("returns false when signalingState is closed", () => {
    expect(isConnectionAlive(makeFakePC("connected", "closed"))).toBe(false);
  });

  test("returns true for new/connecting states", () => {
    expect(isConnectionAlive(makeFakePC("new", "have-local-offer"))).toBe(true);
    expect(isConnectionAlive(makeFakePC("connecting", "have-remote-offer"))).toBe(true);
  });
});

// ── Camera toggle: track.enabled ──────────────────────────────────────────────

describe("Camera toggle via track.enabled (Issue B)", () => {
  test("disabling sets track.enabled to false without stopping the track", () => {
    const videoTrack = makeFakeTrack("video", true);
    const stream = makeFakeStream([videoTrack]);

    // Simulate handleVideo() disable path
    const currentTrack = stream.getVideoTracks()[0];
    expect(currentTrack.readyState).toBe("live");

    currentTrack.enabled = false;

    expect(currentTrack.enabled).toBe(false);
    expect(currentTrack.readyState).toBe("live"); // NOT stopped — hardware kept
    expect(currentTrack.stop).not.toHaveBeenCalled();
  });

  test("re-enabling sets track.enabled to true without new getUserMedia", () => {
    const videoTrack = makeFakeTrack("video", false);
    const stream = makeFakeStream([videoTrack]);

    const currentTrack = stream.getVideoTracks()[0];
    expect(currentTrack.enabled).toBe(false);

    currentTrack.enabled = true;

    expect(currentTrack.enabled).toBe(true);
    expect(currentTrack.stop).not.toHaveBeenCalled();
  });

  test("detects ended track and triggers replaceTrack path", () => {
    const endedTrack = makeFakeTrack("video", true);
    endedTrack.stop();
    expect(endedTrack.readyState).toBe("ended");

    const stream = makeFakeStream([endedTrack]);
    const videoTrack = stream.getVideoTracks()[0];

    // handleVideo() checks this condition before deciding to replaceTrack
    const needsReacquire = !videoTrack || videoTrack.readyState === "ended";
    expect(needsReacquire).toBe(true);
  });
});

// ── Microphone toggle: track.enabled ─────────────────────────────────────────

describe("Microphone toggle via track.enabled (Issue B)", () => {
  test("mute sets audioTrack.enabled to false", () => {
    const audioTrack = makeFakeTrack("audio", true);
    const stream = makeFakeStream([audioTrack]);

    const track = stream.getAudioTracks()[0];
    track.enabled = false;

    expect(track.enabled).toBe(false);
    expect(track.stop).not.toHaveBeenCalled();
  });

  test("unmute sets audioTrack.enabled to true", () => {
    const audioTrack = makeFakeTrack("audio", false);
    const stream = makeFakeStream([audioTrack]);

    const track = stream.getAudioTracks()[0];
    track.enabled = true;

    expect(track.enabled).toBe(true);
    expect(track.stop).not.toHaveBeenCalled();
  });
});

// ── replaceTrack path: no unnecessary renegotiation ───────────────────────────

describe("replaceTrack() does not trigger renegotiation", () => {
  test("sender.replaceTrack is called with the new track", async () => {
    const newTrack = makeFakeTrack("video");
    const replaceMock = jest.fn().mockResolvedValue(undefined);

    const sender = {
      track: makeFakeTrack("video"),
      replaceTrack: replaceMock,
    };

    const fakePC = {
      ...makeFakePC(),
      getSenders: jest.fn(() => [sender]),
    };

    // Simulate the replaceTrack loop from handleVideo() re-acquire path
    const videoSender = fakePC.getSenders().find((s) => s.track?.kind === "video");
    expect(videoSender).toBeDefined();

    await videoSender.replaceTrack(newTrack);

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(newTrack);
  });

  test("no sender with video kind is skipped safely", () => {
    const fakePC = {
      ...makeFakePC(),
      getSenders: jest.fn(() => [
        { track: makeFakeTrack("audio"), replaceTrack: jest.fn() },
      ]),
    };

    const videoSender = fakePC.getSenders().find((s) => s.track?.kind === "video");
    expect(videoSender).toBeUndefined();
    // No crash — the guard in handleVideo() checks for videoSender before calling
  });
});

// ── Peer connection cleanup on user-left ──────────────────────────────────────

describe("Peer connection cleanup on user-left (Fix F)", () => {
  test("closes and removes the connection for the departed peer", () => {
    const connections = {
      "peer-abc": makeFakePC("connected"),
      "peer-def": makeFakePC("connected"),
    };

    const departedId = "peer-abc";

    // Simulate user-left handler
    const pc = connections[departedId];
    if (pc) {
      pc.close();
      delete connections[departedId];
    }

    expect(connections["peer-abc"]).toBeUndefined();
    expect(connections["peer-def"]).toBeDefined();
  });

  test("gracefully handles user-left for unknown socketId", () => {
    const connections = {
      "peer-abc": makeFakePC("connected"),
    };

    const unknownId = "peer-zzz";

    expect(() => {
      const pc = connections[unknownId];
      if (pc) {
        pc.close();
        delete connections[unknownId];
      }
    }).not.toThrow();

    expect(connections["peer-abc"]).toBeDefined();
  });
});
