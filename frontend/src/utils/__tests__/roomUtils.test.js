import { extractRoomCode, copyToClipboard } from "../roomUtils";

describe("roomUtils — extractRoomCode", () => {
  test("extracts room code from simple string parameter", () => {
    expect(extractRoomCode("sangam-g95wan")).toBe("sangam-g95wan");
  });

  test("extracts room code from full HTTPS URL", () => {
    expect(
      extractRoomCode("", "https://sangamconnect.com/sangam-g95wan")
    ).toBe("sangam-g95wan");
  });

  test("extracts room code from URL with query params and trailing slash", () => {
    expect(
      extractRoomCode("", "https://sangamconnect.com/sangam-alpha123/?ref=invite")
    ).toBe("sangam-alpha123");
  });

  test("extracts room code if route param itself contains a full path", () => {
    expect(extractRoomCode("/meetings/room-9988")).toBe("room-9988");
  });

  test("falls back to default code when inputs are empty or null", () => {
    expect(extractRoomCode(null, "")).toBe("sangam-meet");
    expect(extractRoomCode("", "")).toBe("sangam-meet");
    expect(extractRoomCode("   ", "")).toBe("sangam-meet");
  });
});

describe("roomUtils — copyToClipboard", () => {
  test("returns false for empty input", async () => {
    const result = await copyToClipboard("");
    expect(result).toBe(false);
  });

  test("uses navigator.clipboard.writeText when available", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const result = await copyToClipboard("sangam-code-123");
    expect(writeTextMock).toHaveBeenCalledWith("sangam-code-123");
    expect(result).toBe(true);
  });
});
