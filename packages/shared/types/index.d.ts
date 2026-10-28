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
