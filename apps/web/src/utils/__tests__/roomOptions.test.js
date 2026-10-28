import { describe, it, expect } from "vitest";
import { Room } from "livekit-client";
import { ROOM_OPTIONS } from "@sangam/shared";

describe("shared LiveKit ROOM_OPTIONS", () => {
  it("enables adaptive stream, dynacast, simulcast with a 360p fallback, and Opus DTX/RED", () => {
    expect(ROOM_OPTIONS.adaptiveStream).toBe(true);
    expect(ROOM_OPTIONS.dynacast).toBe(true);
    expect(ROOM_OPTIONS.publishDefaults).toMatchObject({ simulcast: true, dtx: true, red: true });
    expect(ROOM_OPTIONS.publishDefaults.videoSimulcastLayers.map((l) => l.height)).toEqual([180, 360]);
    expect(ROOM_OPTIONS.audioCaptureDefaults).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
    });
  });

  it("is accepted by livekit-client Room and survives option merging", () => {
    const room = new Room(ROOM_OPTIONS);
    expect(room.options.adaptiveStream).toBe(true);
    expect(room.options.dynacast).toBe(true);
    expect(room.options.publishDefaults.dtx).toBe(true);
    expect(room.options.publishDefaults.red).toBe(true);
    expect(room.options.publishDefaults.videoSimulcastLayers).toHaveLength(2);
    expect(room.options.videoCaptureDefaults.resolution.height).toBe(720);
  });
});
