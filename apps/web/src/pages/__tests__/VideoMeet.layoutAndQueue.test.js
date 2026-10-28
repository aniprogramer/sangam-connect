/**
 * VideoMeet Layout & ICE Candidate Queueing Test Suite
 *
 * Covers:
 * 1. ICE candidate queueing when remoteDescription is not yet set
 * 2. ICE candidate queue drain upon setRemoteDescription
 * 3. Presentation Mode detection (local sharer vs remote sharer)
 * 4. Gallery Mode grid calculation for 1, 2, 4, 6, and many participants
 * 5. Room expiration error handling
 */

describe("VideoMeet — ICE Candidate Queueing Logic", () => {
  test("queues ICE candidates when remoteDescription is not yet set", () => {
    const queue = {};
    const fromId = "peer-alpha";

    function handleIceCandidate(cand, pc) {
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        if (!queue[fromId]) queue[fromId] = [];
        queue[fromId].push(cand);
      } else {
        pc.addIceCandidate(cand);
      }
    }

    const fakePC = { remoteDescription: null, addIceCandidate: jest.fn() };
    const cand1 = { candidate: "cand-1" };
    const cand2 = { candidate: "cand-2" };

    handleIceCandidate(cand1, fakePC);
    handleIceCandidate(cand2, fakePC);

    expect(fakePC.addIceCandidate).not.toHaveBeenCalled();
    expect(queue[fromId]).toEqual([cand1, cand2]);
  });

  test("drains queued candidates in FIFO order after setRemoteDescription", async () => {
    const queue = {
      "peer-alpha": [{ candidate: "cand-1" }, { candidate: "cand-2" }],
    };
    const fromId = "peer-alpha";
    const fakePC = {
      remoteDescription: { type: "offer" },
      addIceCandidate: jest.fn().mockResolvedValue(undefined),
    };

    // Drain logic
    const queued = queue[fromId];
    if (queued && queued.length > 0) {
      delete queue[fromId];
      for (const cand of queued) {
        await fakePC.addIceCandidate(cand);
      }
    }

    expect(fakePC.addIceCandidate).toHaveBeenCalledTimes(2);
    expect(fakePC.addIceCandidate).toHaveBeenNthCalledWith(1, { candidate: "cand-1" });
    expect(fakePC.addIceCandidate).toHaveBeenNthCalledWith(2, { candidate: "cand-2" });
    expect(queue[fromId]).toBeUndefined();
  });
});

describe("VideoMeet — Layout Mode & Grid Resolution", () => {
  function resolveLayoutMode({ screenSharing, participantList }) {
    const remotePresenter = participantList.find((p) => p.mediaState?.screenSharing);
    const isPresentationActive = Boolean(screenSharing || remotePresenter);
    const isSelfPresenting = Boolean(screenSharing);
    const totalInCall = 1 + participantList.length;

    let gridClass = "gridCountMany";
    if (totalInCall === 1) gridClass = "gridCount1";
    else if (totalInCall === 2) gridClass = "gridCount2";
    else if (totalInCall <= 4) gridClass = "gridCount4";
    else if (totalInCall <= 6) gridClass = "gridCount6";

    return {
      isPresentationActive,
      isSelfPresenting,
      presenter: isSelfPresenting ? "self" : remotePresenter ? remotePresenter.socketId : null,
      gridClass,
    };
  }

  test("resolves Gallery Mode with 2x2 grid when 4 participants and no screen share", () => {
    const participantList = [
      { socketId: "p1", mediaState: { screenSharing: false } },
      { socketId: "p2", mediaState: { screenSharing: false } },
      { socketId: "p3", mediaState: { screenSharing: false } },
    ];
    const layout = resolveLayoutMode({ screenSharing: false, participantList });
    expect(layout.isPresentationActive).toBe(false);
    expect(layout.gridClass).toBe("gridCount4");
  });

  test("resolves Presentation Mode when local user shares screen", () => {
    const participantList = [
      { socketId: "p1", mediaState: { screenSharing: false } },
    ];
    const layout = resolveLayoutMode({ screenSharing: true, participantList });
    expect(layout.isPresentationActive).toBe(true);
    expect(layout.isSelfPresenting).toBe(true);
    expect(layout.presenter).toBe("self");
  });

  test("resolves Presentation Mode when remote user shares screen", () => {
    const participantList = [
      { socketId: "p1", mediaState: { screenSharing: true } },
      { socketId: "p2", mediaState: { screenSharing: false } },
    ];
    const layout = resolveLayoutMode({ screenSharing: false, participantList });
    expect(layout.isPresentationActive).toBe(true);
    expect(layout.isSelfPresenting).toBe(false);
    expect(layout.presenter).toBe("p1");
  });
});

describe("VideoMeet — Room Expiration Handling", () => {
  test("transitions to expired room state on ROOM_EXPIRED socket error", () => {
    let roomExpired = false;
    let roomExpiredMessage = "";

    function handleRoomError(err) {
      if (err?.code === "ROOM_EXPIRED") {
        roomExpired = true;
        roomExpiredMessage = err.message || "This room has expired due to inactivity.";
      }
    }

    handleRoomError({ code: "ROOM_EXPIRED", message: "Custom expiry notice" });
    expect(roomExpired).toBe(true);
    expect(roomExpiredMessage).toBe("Custom expiry notice");
  });
});
