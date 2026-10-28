import { renderHook, act } from "@testing-library/react";
import { useNetworkDiagnostics } from "../useNetworkDiagnostics";

describe("useNetworkDiagnostics hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("returns initial Good state when idle and online", async () => {
    const { result } = renderHook(() => useNetworkDiagnostics());

    await act(async () => {
      jest.advanceTimersByTime(10);
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.quality).toBe("Good");
    expect(result.current.activePeersCount).toBe(0);
  });

  test("detects offline status immediately", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const { result } = renderHook(() => useNetworkDiagnostics());

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      jest.advanceTimersByTime(10);
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.quality).toBe("Offline");
  });

  test("detects reconnecting peer connection state", async () => {
    const mockPc = {
      connectionState: "connecting",
      iceConnectionState: "checking",
      getStats: jest.fn().mockResolvedValue(new Map()),
    };
    const connectionsRef = {
      current: {
        peer1: mockPc,
      },
    };

    const { result } = renderHook(() =>
      useNetworkDiagnostics(connectionsRef, { pollIntervalMs: 500 })
    );

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(result.current.quality).toBe("Reconnecting");
    expect(result.current.activePeersCount).toBe(1);
  });

  test("processes RTCPeerConnection stats correctly", async () => {
    const reports = [
      {
        type: "candidate-pair",
        state: "succeeded",
        selected: true,
        currentRoundTripTime: 0.045, // 45ms
      },
      {
        type: "inbound-rtp",
        kind: "video",
        bytesReceived: 50000,
        packetsReceived: 200,
        packetsLost: 2,
        jitter: 0.005, // 5ms
      },
      {
        type: "outbound-rtp",
        bytesSent: 30000,
      },
    ];

    const mockPc = {
      connectionState: "connected",
      iceConnectionState: "connected",
      getStats: jest.fn().mockResolvedValue(reports),
    };
    const connectionsRef = {
      current: {
        peer1: mockPc,
      },
    };

    const { result } = renderHook(() =>
      useNetworkDiagnostics(connectionsRef, { pollIntervalMs: 1000 })
    );

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(mockPc.getStats).toHaveBeenCalled();
    expect(result.current.rtt).toBe(45);
    expect(result.current.jitter).toBe(5);
    expect(result.current.quality).toBe("Good");
  });

  test("cleans up interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useNetworkDiagnostics());

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
