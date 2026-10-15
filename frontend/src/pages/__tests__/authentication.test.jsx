import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthContext } from "../../contexts/AuthContext";
import { ThemeProvider } from "../../contexts/ThemeContext";
import Authentication from "../authentication";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/register" }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockAuthContext = {
  handleRegister: jest.fn(),
  handleVerifyEmail: jest.fn(),
  handleResendVerification: jest.fn(),
  handleLogin: jest.fn(),
  pendingVerifyEmail: "",
};

function renderAuth(initialTheme = "light") {
  localStorage.setItem("sangam_theme", initialTheme);
  document.documentElement.setAttribute("data-theme", initialTheme);

  return render(
    <ThemeProvider>
      <AuthContext.Provider value={mockAuthContext}>
        <Authentication />
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

describe("Authentication Page Theme & Interaction", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("renders in light theme with light hero illustration and avatars", () => {
    renderAuth("light");

    // Eyebrow and headlines
    expect(screen.getByText(/VIDEO • VOICE • COMMUNITY/i)).toBeInTheDocument();
    expect(screen.getByText(/Where Voices/i)).toBeInTheDocument();
    expect(screen.getByText(/Converge/i)).toBeInTheDocument();

    // Check center illustration has light asset
    const heroImg = screen.getByAltText("Interactive Video Conference Visual");
    expect(heroImg).toHaveAttribute("src", "/assets/hero_illustration_light.png");

    // Check avatars has light asset
    const avatarsImg = screen.getByAltText("Community participants");
    expect(avatarsImg).toHaveAttribute("src", "/assets/avatars_light.png");
  });

  test("renders in dark theme with dark hero illustration and avatars", () => {
    renderAuth("dark");

    const heroImg = screen.getByAltText("Interactive Video Conference Visual");
    expect(heroImg).toHaveAttribute("src", "/assets/hero_illustration_transparent.png");

    const avatarsImg = screen.getByAltText("Community participants");
    expect(avatarsImg).toHaveAttribute("src", "/assets/avatars_stack_transparent.png");
  });

  test("switches between Sign In and Create Account modes", () => {
    renderAuth("light");

    // Click Sign In tab
    const signInTab = screen.getByRole("tab", { name: /Sign In/i });
    fireEvent.click(signInTab);

    // Verify Sign In view elements
    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByText(/Keep me signed in/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgot password\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();

    // Click Create Account tab
    const createTab = screen.getByRole("tab", { name: /Create Account/i });
    fireEvent.click(createTab);

    // Verify Create Account view elements
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
  });

  test("toggles theme when ThemeToggle is clicked", () => {
    renderAuth("light");

    const toggleBtn = screen.getByLabelText(/Switch to dark theme/i);
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    const heroImg = screen.getByAltText("Interactive Video Conference Visual");
    expect(heroImg).toHaveAttribute("src", "/assets/hero_illustration_transparent.png");
  });
});
