import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthContext } from "../../contexts/AuthContext";
import { ThemeProvider } from "../../contexts/ThemeContext";
import HistoryComponent from "../history";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mockAuthContext = {
  user: { name: "Test User", email: "test@sangam.connect" },
  userData: { name: "Test User", username: "test-563f" },
  getHistoryOfUser: jest.fn().mockResolvedValue([]),
  deleteUserHistoryItem: jest.fn().mockResolvedValue({}),
  clearAllUserHistory: jest.fn().mockResolvedValue({}),
};

async function renderHistory() {
  let view;
  await React.act(async () => {
    view = render(
      <ThemeProvider>
        <AuthContext.Provider value={mockAuthContext}>
          <HistoryComponent />
        </AuthContext.Provider>
      </ThemeProvider>
    );
  });
  return view;
}

describe("Meeting History Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders navigation, page header, and sub-label", async () => {
    await renderHistory();

    expect(screen.getByText(/Sangam Connect/i)).toBeInTheDocument();
    expect(screen.getByText("MEETING HISTORY")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meeting History" })).toBeInTheDocument();
    expect(screen.getByText(/Clear History/i)).toBeInTheDocument();
  });

  test("renders meeting cards with status badges and re-join actions", async () => {
    await renderHistory();

    expect(screen.getByText("sangam-g95wan")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("5 Active")).toBeInTheDocument();
    expect(screen.getByText("Secure P2P")).toBeInTheDocument();

    expect(screen.getByText("sangam-28heon")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();

    expect(screen.getByText("sangam-o29by3")).toBeInTheDocument();
    expect(screen.getByText("Past")).toBeInTheDocument();
  });

  test("renders 'At a Glance' analytics sidebar with metrics", async () => {
    await renderHistory();

    expect(screen.getByRole("heading", { name: /At a Glance/i })).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Total Meets:")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("Time Active:")).toBeInTheDocument();
    expect(screen.getByText("14h 32m")).toBeInTheDocument();
    expect(screen.getByText("1 Live")).toBeInTheDocument();
  });

  test("filters meeting cards by search input", async () => {
    await renderHistory();

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "28heon" } });

    expect(screen.getByText("sangam-28heon")).toBeInTheDocument();
    expect(screen.queryByText("sangam-g95wan")).not.toBeInTheDocument();
    expect(screen.queryByText("sangam-o29by3")).not.toBeInTheDocument();
  });

  test("navigates to room on Re-join Call click", async () => {
    await renderHistory();

    const rejoinButtons = screen.getAllByRole("button", { name: /Re-join Call/i });
    fireEvent.click(rejoinButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/sangam-g95wan");
  });
});
