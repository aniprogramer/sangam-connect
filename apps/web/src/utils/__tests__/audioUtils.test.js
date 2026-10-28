import { safeCloseAudioContext, createSafeAudioContext } from "../audioUtils";

describe("audioUtils — safeCloseAudioContext", () => {
  test("handles null and undefined safely without throwing", async () => {
    await expect(safeCloseAudioContext(null)).resolves.toBeUndefined();
    await expect(safeCloseAudioContext(undefined)).resolves.toBeUndefined();
  });

  test("does not call close() if context state is already 'closed'", async () => {
    const closeMock = jest.fn().mockResolvedValue(undefined);
    const mockCtx = {
      state: "closed",
      close: closeMock,
    };

    await safeCloseAudioContext(mockCtx);
    expect(closeMock).not.toHaveBeenCalled();
  });

  test("calls close() if context state is 'running' or 'suspended'", async () => {
    const closeMock = jest.fn().mockResolvedValue(undefined);
    const mockCtx = {
      state: "running",
      close: closeMock,
    };

    await safeCloseAudioContext(mockCtx);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("gracefully absorbs asynchronous promise rejection from close()", async () => {
    const closeMock = jest.fn().mockRejectedValue(new Error("Cannot close a closed AudioContext"));
    const mockCtx = {
      state: "running",
      close: closeMock,
    };

    // Must not throw or bubble unhandled rejection
    await expect(safeCloseAudioContext(mockCtx)).resolves.toBeUndefined();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("multiple calls on same context are idempotent", async () => {
    let state = "running";
    const closeMock = jest.fn().mockImplementation(() => {
      state = "closed";
      return Promise.resolve();
    });

    const mockCtx = {
      get state() {
        return state;
      },
      close: closeMock,
    };

    await safeCloseAudioContext(mockCtx);
    await safeCloseAudioContext(mockCtx);
    await safeCloseAudioContext(mockCtx);

    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});

describe("audioUtils — createSafeAudioContext", () => {
  test("creates audio context when supported", () => {
    const ctx = createSafeAudioContext();
    expect(ctx).toBeDefined();
  });
});
