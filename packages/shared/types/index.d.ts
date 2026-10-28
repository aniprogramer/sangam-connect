/**
 * @sangam/shared — TypeScript Type Definitions
 */

export declare function extractRoomCode(urlParam?: string, fullUrl?: string): string;

export declare function copyToClipboard(text: string): Promise<boolean>;

export declare function safeCloseAudioContext(ctx?: AudioContext | null): Promise<void>;

export declare function createSafeAudioContext(): AudioContext | null;

export declare function parseEmojiShortcodes(text: string): string;

export declare function formatDuration(seconds: number): string;

export declare function getUserInitials(name?: string): string;

export declare function formatDate(dateInput: string | Date | number): string;

/** LiveKit RoomOptions shared by web and mobile. */
export declare const ROOM_OPTIONS: Readonly<{
  adaptiveStream: boolean;
  dynacast: boolean;
  videoCaptureDefaults: { resolution: { width: number; height: number; frameRate: number } };
  audioCaptureDefaults: { echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean };
  publishDefaults: {
    simulcast: boolean;
    videoCodec: "vp8";
    videoSimulcastLayers: { width: number; height: number; encoding: { maxBitrate: number; maxFramerate: number } }[];
    dtx: boolean;
    red: boolean;
  };
}>;
