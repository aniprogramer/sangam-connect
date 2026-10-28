import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import NetworkStatusBadge from "../NetworkStatusBadge";

describe("NetworkStatusBadge LiveKit connection state", () => {
  it.each(["reconnecting", "signalReconnecting"])("shows Reconnecting while LiveKit is %s", (state) => {
    render(<NetworkStatusBadge connectionState={state} />);
    expect(screen.getByRole("button", { name: /Network status: Reconnecting/ })).toBeInTheDocument();
  });

  it("falls back to measured quality once reconnected", () => {
    render(<NetworkStatusBadge connectionState="connected" />);
    expect(screen.queryByRole("button", { name: /Reconnecting/ })).not.toBeInTheDocument();
  });
});
