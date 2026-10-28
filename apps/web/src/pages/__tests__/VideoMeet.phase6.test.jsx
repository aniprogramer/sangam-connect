import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolvePersonalRoomCode } from "@sangam/shared";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import DeviceSettingsModal from "../../components/DeviceSettingsModal";

describe("Phase 6 — Frontend Features Test Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Personal Room Code Resolution", () => {
    it("resolves @username to user-username canonical room id", () => {
      expect(resolvePersonalRoomCode("@aniket")).toBe("user-aniket");
      expect(resolvePersonalRoomCode("@JohnDoe")).toBe("user-johndoe");
      expect(resolvePersonalRoomCode("regular-room")).toBe("regular-room");
      expect(resolvePersonalRoomCode("")).toBe("");
    });
  });

  describe("Grid Pagination Logic", () => {
    const PAGE_SIZE = 25;
    it("calculates correct pages and slices participants", () => {
      const mockParticipants = Array.from({ length: 55 }, (_, i) => ({
        identity: `peer-${i}`,
        name: `User ${i}`,
      }));

      const totalPages = Math.ceil(mockParticipants.length / PAGE_SIZE);
      expect(totalPages).toBe(3);

      const page0 = mockParticipants.slice(0, PAGE_SIZE);
      expect(page0.length).toBe(25);
      expect(page0[0].identity).toBe("peer-0");
      expect(page0[24].identity).toBe("peer-24");

      const page1 = mockParticipants.slice(PAGE_SIZE, PAGE_SIZE * 2);
      expect(page1.length).toBe(25);
      expect(page1[0].identity).toBe("peer-25");

      const page2 = mockParticipants.slice(PAGE_SIZE * 2, PAGE_SIZE * 3);
      expect(page2.length).toBe(5);
      expect(page2[0].identity).toBe("peer-50");
    });
  });

  describe("View Mode Toggle & Persistence", () => {
    it("persists view mode selection to localStorage", () => {
      let viewMode = localStorage.getItem("sangam_view_mode") || "gallery";
      expect(viewMode).toBe("gallery");

      // Toggle to speaker
      viewMode = viewMode === "gallery" ? "speaker" : "gallery";
      localStorage.setItem("sangam_view_mode", viewMode);
      expect(localStorage.getItem("sangam_view_mode")).toBe("speaker");

      // Toggle back to gallery
      viewMode = viewMode === "gallery" ? "speaker" : "gallery";
      localStorage.setItem("sangam_view_mode", viewMode);
      expect(localStorage.getItem("sangam_view_mode")).toBe("gallery");
    });
  });

  describe("Hand-raise State Management", () => {
    it("adds and removes identities from raisedHands set upon socket events", () => {
      const raisedHands = new Set();

      // Hand raise event
      const payload1 = { socketId: "sock-1", identity: "peer-1", raised: true };
      if (payload1.raised) {
        raisedHands.add(payload1.socketId);
        if (payload1.identity) raisedHands.add(payload1.identity);
      }
      expect(raisedHands.has("peer-1")).toBe(true);
      expect(raisedHands.has("sock-1")).toBe(true);

      // Hand lower event
      const payload2 = { socketId: "sock-1", identity: "peer-1", raised: false };
      if (!payload2.raised) {
        raisedHands.delete(payload2.socketId);
        if (payload2.identity) raisedHands.delete(payload2.identity);
      }
      expect(raisedHands.has("peer-1")).toBe(false);
      expect(raisedHands.has("sock-1")).toBe(false);
    });
  });

  describe("ParticipantsPanel Phase 6 Moderation Controls", () => {
    it("renders waiting room participants and fires admit/deny handlers", () => {
      const handleAdmit = vi.fn();
      const handleDeny = vi.fn();
      const waiting = [{ socketId: "wait-1", identity: "id-1", name: "Alice Waiting" }];

      render(
        <ParticipantsPanel
          isOpen={true}
          onClose={() => {}}
          participants={[]}
          localParticipant={{ username: "Host", isGuest: false }}
          isHost={true}
          waitingParticipants={waiting}
          onAdmit={handleAdmit}
          onDeny={handleDeny}
        />
      );

      expect(screen.getByText(/Alice Waiting/i)).toBeInTheDocument();
      expect(screen.getByText(/Waiting Room/i)).toBeInTheDocument();

      const admitBtn = screen.getByText("Admit");
      fireEvent.click(admitBtn);
      expect(handleAdmit).toHaveBeenCalledWith(waiting[0]);

      const denyBtn = screen.getByText("Deny");
      fireEvent.click(denyBtn);
      expect(handleDeny).toHaveBeenCalledWith(waiting[0]);
    });

    it("renders host moderation quick actions: Mute All and Lock Room", () => {
      const handleMuteAll = vi.fn();
      const handleToggleLock = vi.fn();

      render(
        <ParticipantsPanel
          isOpen={true}
          onClose={() => {}}
          participants={[]}
          localParticipant={{ username: "Host", isGuest: false }}
          isHost={true}
          isLocked={false}
          onMuteAll={handleMuteAll}
          onToggleLock={handleToggleLock}
        />
      );

      const muteAllBtn = screen.getByText(/Mute All/i);
      fireEvent.click(muteAllBtn);
      expect(handleMuteAll).toHaveBeenCalled();

      const lockBtn = screen.getByText(/Lock Room/i);
      fireEvent.click(lockBtn);
      expect(handleToggleLock).toHaveBeenCalled();
    });

    it("displays raised hand indicator for participants with raised hands", () => {
      const remote = [
        {
          socketId: "sock-2",
          username: "Bob",
          isGuest: false,
          mediaState: { mic: true, camera: true },
        },
      ];
      const raised = new Set(["sock-2"]);

      render(
        <ParticipantsPanel
          isOpen={true}
          onClose={() => {}}
          participants={remote}
          localParticipant={{ username: "Host", isGuest: false }}
          isHost={false}
          raisedHands={raised}
        />
      );

      expect(screen.getByTitle("Hand raised")).toBeInTheDocument();
    });
  });

  describe("DeviceSettingsModal Phase 6 Options", () => {
    it("renders virtual background effects and noise suppression toggle", () => {
      render(
        <DeviceSettingsModal
          isOpen={true}
          onClose={() => {}}
          activeCameraId=""
          activeMicId=""
          onSelectCamera={() => {}}
          onSelectMic={() => {}}
        />
      );

      expect(screen.getByText(/Background Effects/i)).toBeInTheDocument();
      expect(screen.getByText(/Audio Noise Suppression/i)).toBeInTheDocument();
      expect(screen.getByText(/None/i)).toBeInTheDocument();
      expect(screen.getByText(/Blur/i)).toBeInTheDocument();
      expect(screen.getByText(/Virtual Studio/i)).toBeInTheDocument();
      expect(screen.getByText(/Virtual Office/i)).toBeInTheDocument();
    });
  });
});
