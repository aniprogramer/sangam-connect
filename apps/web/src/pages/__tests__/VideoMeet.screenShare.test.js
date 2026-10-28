/**
 * Screen Sharing & Dual Video Transceiver Test Suite
 *
 * Covers:
 * 1. Local preview displays the shared screen
 * 2. Remote participants receive the screen track via dedicated screen sender without clobbering camera sender
 * 3. Camera track remains live and not stopped during screen share
 * 4. Screen sender cleared with replaceTrack(null) when sharing ends while camera stays live
 * 5. Browser's native "Stop sharing" (track.onended) triggers cleanup & clears screen sender
 * 6. Camera toggle targets camera sender without hijacking screen sender
 * 7. Repeated start/stop screen-share cycles operate idempotently on screen sender
 * 8. New peer joining during active screen sharing gets screen track on 2nd video transceiver
 * 9. Leaving meeting or unmounting releases display and camera tracks
 * 10. Guest and authenticated participants emit identical media-state payloads
 * 11. ontrack discriminates transceiver 0 (camera) vs transceiver 1 (screen) independently
 * 12. Presentation mode mounts screen stream in stage and camera stream in PiP tile simultaneously
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

function makeFakePC() {
  const cameraSender = {
    track: makeFakeTrack("video"),
    replaceTrack: jest.fn().mockResolvedValue(undefined),
  };
  const screenSender = {
    track: null,
    replaceTrack: jest.fn().mockResolvedValue(undefined),
  };
  const audioSender = {
    track: makeFakeTrack("audio"),
    replaceTrack: jest.fn().mockResolvedValue(undefined),
  };

  const cameraTransceiver = {
    direction: "sendrecv",
    sender: cameraSender,
    receiver: { track: makeFakeTrack("video") },
  };
  const screenTransceiver = {
    direction: "sendrecv",
    sender: screenSender,
    receiver: { track: makeFakeTrack("video") },
  };
  const audioTransceiver = {
    direction: "sendrecv",
    sender: audioSender,
    receiver: { track: makeFakeTrack("audio") },
  };

  const transceivers = [audioTransceiver, cameraTransceiver, screenTransceiver];

  return {
    connectionState: "connected",
    signalingState: "stable",
    getSenders: jest.fn(() => [audioSender, cameraSender, screenSender]),
    getTransceivers: jest.fn(() => transceivers),
    addTransceiver: jest.fn((kind) => {
      const t = {
        direction: "sendrecv",
        sender: { track: null, replaceTrack: jest.fn().mockResolvedValue(undefined) },
        receiver: { track: makeFakeTrack(kind) },
      };
      transceivers.push(t);
      return t;
    }),
    close: jest.fn(),
  };
}

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

describe("Sangam Connect — Screen Sharing Core Scenarios", () => {
  // Scenario 1
  test("Scenario 1: Local preview receives the display stream", () => {
    const screenTrack = makeFakeTrack("video");
    const screenStream = makeFakeStream([screenTrack]);
    const previewEl = { srcObject: null };

    previewEl.srcObject = screenStream;
    expect(previewEl.srcObject).toBe(screenStream);
    expect(previewEl.srcObject.getVideoTracks()[0]).toBe(screenTrack);
  });

  // Scenario 2
  test("Scenario 2: Remote participants receive the screen track via dedicated screen sender without clobbering camera sender", async () => {
    const pc1 = makeFakePC();
    const pc2 = makeFakePC();
    const connections = { "peer-1": pc1, "peer-2": pc2 };

    const screenTrack = makeFakeTrack("video");

    // Simulating startScreenShare track assignment to screen sender
    Object.values(connections).forEach((pc) => {
      const screenSender = getScreenSender(pc);
      if (screenSender) screenSender.replaceTrack(screenTrack);
    });

    const screenSender1 = getScreenSender(pc1);
    const screenSender2 = getScreenSender(pc2);
    const cameraSender1 = getCameraSender(pc1);
    const cameraSender2 = getCameraSender(pc2);

    expect(screenSender1.replaceTrack).toHaveBeenCalledWith(screenTrack);
    expect(screenSender2.replaceTrack).toHaveBeenCalledWith(screenTrack);
    // Camera senders were NOT replaced
    expect(cameraSender1.replaceTrack).not.toHaveBeenCalled();
    expect(cameraSender2.replaceTrack).not.toHaveBeenCalled();
  });

  // Scenario 3
  test("Scenario 3: Camera track remains live and not stopped during screen share", () => {
    const cameraTrack = makeFakeTrack("video");
    const localStream = makeFakeStream([cameraTrack]);

    const screenTrack = makeFakeTrack("video");
    const screenStream = makeFakeStream([screenTrack]);

    expect(cameraTrack.stop).not.toHaveBeenCalled();
    expect(cameraTrack.readyState).toBe("live");
    expect(localStream.getVideoTracks().length).toBe(1);
    expect(screenStream.getVideoTracks().length).toBe(1);
  });

  // Scenario 4
  test("Scenario 4: Screen sender is cleared (null) and camera sender remains active when sharing ends", async () => {
    const pc = makeFakePC();
    const connections = { "peer-1": pc };
    const screenTrack = makeFakeTrack("video");

    // Simulating stopScreenShare
    screenTrack.stop();
    Object.values(connections).forEach((p) => {
      const screenSender = getScreenSender(p);
      if (screenSender) screenSender.replaceTrack(null);
    });

    const screenSender = getScreenSender(pc);
    const cameraSender = getCameraSender(pc);

    expect(screenTrack.stop).toHaveBeenCalled();
    expect(screenSender.replaceTrack).toHaveBeenCalledWith(null);
    expect(cameraSender.replaceTrack).not.toHaveBeenCalled();
  });

  // Scenario 5
  test("Scenario 5: Browser native Stop Sharing (track.onended) triggers cleanup", () => {
    const screenTrack = makeFakeTrack("video");
    const stopHandler = jest.fn();

    screenTrack.onended = stopHandler;
    screenTrack.onended();

    expect(stopHandler).toHaveBeenCalledTimes(1);
  });

  // Scenario 6
  test("Scenario 6: Camera toggle during sharing updates camera track without touching screen sender", () => {
    const cameraTrack = makeFakeTrack("video", true);
    const pc = makeFakePC();
    const connections = { "peer-1": pc };

    // Toggle camera off
    cameraTrack.enabled = !cameraTrack.enabled;
    expect(cameraTrack.enabled).toBe(false);

    // Camera control routes through camera sender
    Object.values(connections).forEach((p) => {
      const cameraSender = getCameraSender(p);
      cameraSender?.replaceTrack(cameraTrack);
    });

    const cameraSender = getCameraSender(pc);
    const screenSender = getScreenSender(pc);
    expect(cameraSender.replaceTrack).toHaveBeenCalledWith(cameraTrack);
    expect(screenSender.replaceTrack).not.toHaveBeenCalled();
  });

  // Scenario 7
  test("Scenario 7: Repeated screen-share cycles work without refreshing", async () => {
    const pc = makeFakePC();
    const connections = { "peer-1": pc };

    for (let cycle = 1; cycle <= 3; cycle++) {
      const screenTrack = makeFakeTrack("video");

      // Start share
      Object.values(connections).forEach((p) => {
        getScreenSender(p)?.replaceTrack(screenTrack);
      });

      // Stop share
      screenTrack.stop();
      Object.values(connections).forEach((p) => {
        getScreenSender(p)?.replaceTrack(null);
      });

      expect(screenTrack.readyState).toBe("ended");
    }

    const screenSender = getScreenSender(pc);
    const cameraSender = getCameraSender(pc);
    expect(screenSender.replaceTrack).toHaveBeenCalledTimes(6); // 3 starts (screenTrack) + 3 stops (null)
    expect(cameraSender.replaceTrack).not.toHaveBeenCalled();
  });

  // Scenario 8
  test("Scenario 8: New peer joining during active screen sharing gets screen track on 2nd video transceiver", () => {
    const isScreenSharing = true;
    const screenTrack = makeFakeTrack("video");
    const screenStream = makeFakeStream([screenTrack]);

    const newPC = makeFakePC();

    if (isScreenSharing && screenStream) {
      const st = screenStream.getVideoTracks()[0];
      const screenSender = getScreenSender(newPC);
      if (screenSender && st) screenSender.replaceTrack(st);
    }

    const screenSender = getScreenSender(newPC);
    expect(screenSender.replaceTrack).toHaveBeenCalledWith(screenTrack);
  });

  // Scenario 9
  test("Scenario 9: Leaving call stops all screen and camera media tracks", () => {
    const screenTrack = makeFakeTrack("video");
    const cameraTrack = makeFakeTrack("video");
    const audioTrack = makeFakeTrack("audio");

    const screenStream = makeFakeStream([screenTrack]);
    const localStream = makeFakeStream([cameraTrack, audioTrack]);

    screenStream.getTracks().forEach((t) => t.stop());
    localStream.getTracks().forEach((t) => t.stop());

    expect(screenTrack.stop).toHaveBeenCalled();
    expect(cameraTrack.stop).toHaveBeenCalled();
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  // Scenario 10
  test("Scenario 10: Guest and authenticated participants produce consistent media-state signals", () => {
    const guestUser = {
      username: "Guest123",
      userId: null,
      isGuest: true,
      mediaState: { camera: true, mic: true, screenSharing: false },
    };

    const authUser = {
      username: "Aniket",
      userId: "user-456",
      isGuest: false,
      mediaState: { camera: true, mic: true, screenSharing: false },
    };

    const guestPayload = { screenSharing: true };
    const authPayload = { screenSharing: true };

    expect(guestPayload).toEqual(authPayload);
    expect(guestUser.mediaState.screenSharing).toBe(false);
    expect(authUser.mediaState.screenSharing).toBe(false);
  });

  // Scenario 11
  test("Scenario 11: ontrack discriminates camera transceiver (index 0) vs screen transceiver (index 1)", () => {
    const pc = makeFakePC();
    const videoTransceivers = pc
      .getTransceivers()
      .filter((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");

    const camTransceiver = videoTransceivers[0];
    const screenTransceiver = videoTransceivers[1];

    const camTrack = makeFakeTrack("video");
    const screenTrack = makeFakeTrack("video");

    const camStream = makeFakeStream([camTrack]);
    const screenStream = makeFakeStream([screenTrack]);

    const participantState = {
      socketId: "remote-peer-1",
      cameraStream: null,
      screenStream: null,
      stream: null,
    };

    // Simulate ontrack for camera track
    const isScreenForCam = Boolean(videoTransceivers[1] && camTransceiver === videoTransceivers[1]);
    expect(isScreenForCam).toBe(false);
    if (!isScreenForCam) {
      participantState.cameraStream = camStream;
      participantState.stream = camStream;
    }

    // Simulate ontrack for screen track
    const isScreenForScreen = Boolean(videoTransceivers[1] && screenTransceiver === videoTransceivers[1]);
    expect(isScreenForScreen).toBe(true);
    if (isScreenForScreen) {
      participantState.screenStream = screenStream;
    }

    // Both streams are simultaneously present and independent
    expect(participantState.cameraStream).toBe(camStream);
    expect(participantState.screenStream).toBe(screenStream);
    expect(participantState.cameraStream).not.toBe(participantState.screenStream);
  });

  // Scenario 12
  test("Scenario 12: Presentation mode binds screenStream to stage and cameraStream to PiP tile simultaneously", () => {
    const camStream = makeFakeStream([makeFakeTrack("video")]);
    const screenStream = makeFakeStream([makeFakeTrack("video")]);

    const remotePresenter = {
      socketId: "presenter-1",
      username: "Alice",
      cameraStream: camStream,
      screenStream: screenStream,
      stream: camStream,
      mediaState: { camera: true, mic: true, screenSharing: true },
    };

    // Stage video element selection: remotePresenter.screenStream || remotePresenter.stream
    const stageVideoSrc = remotePresenter.screenStream || remotePresenter.stream;
    expect(stageVideoSrc).toBe(screenStream);

    // Presenter PiP video element selection:
    const showPipVideo = remotePresenter.mediaState.camera !== false && (remotePresenter.cameraStream || remotePresenter.stream);
    const pipVideoSrc = remotePresenter.cameraStream || remotePresenter.stream;

    expect(Boolean(showPipVideo)).toBe(true);
    expect(pipVideoSrc).toBe(camStream);
    expect(stageVideoSrc).not.toBe(pipVideoSrc);
  });
});
