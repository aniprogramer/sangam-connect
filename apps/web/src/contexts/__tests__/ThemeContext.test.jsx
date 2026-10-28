import React from "react";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeContext";

function TestConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme} data-testid="toggle-btn">
        Toggle
      </button>
      <button onClick={() => setTheme("light")} data-testid="set-light-btn">
        Set Light
      </button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  test("defaults to dark theme when no preference stored", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("initializes from localStorage preference", () => {
    localStorage.setItem("sangam_theme", "light");

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  test("toggleTheme toggles between dark and light, updates localStorage and DOM", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("toggle-btn");

    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(localStorage.getItem("sangam_theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(localStorage.getItem("sangam_theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("synchronizes theme on window storage event (cross-tab sync)", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");

    // Simulate cross-tab storage event
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "sangam_theme",
          newValue: "light",
        })
      );
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
