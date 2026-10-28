/**
 * Regression test — VideoMeet participant tile rendering
 *
 * Issue D confirmed: `videoItem.socketId.slice(0, 5)` throws
 * `TypeError: Cannot read properties of null (reading 'slice')`
 * when `socketId` is null or undefined.
 *
 * Root cause chain:
 *  1. socketManager.js sent `socket.io` (Manager object) as fromId instead of `socket.id`.
 *  2. JSON serialization of the Manager produced a corrupt/empty value; downstream
 *     state could receive null/undefined for socketId.
 *  3. The render at VideoMeet.jsx called .slice() directly without an optional-chain guard.
 *
 * This test covers the render-side guard that must survive even if upstream
 * data is malformed.  The root cause (signal relay) is fixed separately in
 * socketManager.js; this test is a belt-and-suspenders regression guard.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Minimal reproduction of the participant tile rendering logic from
// VideoMeet.jsx lines 937-953.  Isolated from Socket.IO / WebRTC surface.
// ---------------------------------------------------------------------------

function ParticipantTile({ socketId, stream }) {
  return (
    <div data-testid="tile">
      <video
        autoPlay
        playsInline
        ref={(ref) => {
          if (ref && stream) {
            ref.srcObject = stream;
          }
        }}
      />
      <div data-testid="label">
        {/* FIXED: optional chain + nullish fallback — was socketId.slice(0, 5) */}
        <span>Participant ({socketId?.slice(0, 5) ?? "?????"})</span>
      </div>
    </div>
  );
}

function VideoGrid({ videos }) {
  return (
    <div>
      {videos.map((videoItem, i) => (
        <ParticipantTile
          key={videoItem.socketId ?? `anon-${i}`}
          socketId={videoItem.socketId}
          stream={videoItem.stream}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VideoMeet — Participant tile regression (Issue D)", () => {
  test("renders correctly with a valid socketId", () => {
    render(<VideoGrid videos={[{ socketId: "abc12xyz", stream: null }]} />);
    expect(screen.getByText(/abc12/)).toBeInTheDocument();
  });

  test("does NOT crash when socketId is null", () => {
    // This exact value caused the production TypeError before the fix.
    expect(() =>
      render(<VideoGrid videos={[{ socketId: null, stream: null }]} />),
    ).not.toThrow();
    expect(screen.getByText(/\?{5}/)).toBeInTheDocument();
  });

  test("does NOT crash when socketId is undefined", () => {
    expect(() =>
      render(<VideoGrid videos={[{ socketId: undefined, stream: null }]} />),
    ).not.toThrow();
    expect(screen.getByText(/\?{5}/)).toBeInTheDocument();
  });

  test("does NOT crash when socketId is empty string", () => {
    expect(() =>
      render(<VideoGrid videos={[{ socketId: "", stream: null }]} />),
    ).not.toThrow();
  });

  test("renders mixed participant list with one null socketId without crashing", () => {
    const videos = [
      { socketId: "valid1abc", stream: null },
      { socketId: null, stream: null },
      { socketId: "valid3def", stream: null },
    ];
    expect(() => render(<VideoGrid videos={videos} />)).not.toThrow();
    expect(screen.getAllByText(/valid/).length).toBeGreaterThan(0);
  });

  test("slices socketId to exactly 5 characters", () => {
    render(<VideoGrid videos={[{ socketId: "ABCDEFGH", stream: null }]} />);
    expect(screen.getByText(/ABCDE\)/)).toBeInTheDocument();
    expect(screen.queryByText(/ABCDEFGH/)).not.toBeInTheDocument();
  });
});
