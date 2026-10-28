import "./App.css";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Authentication from "./pages/authentication";
import LandingPage from "./pages/landing";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import HomeComponent from "./pages/home";
import HistoryComponent from "./pages/history";
import VideoMeetComponent from "./pages/VideoMeet";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "var(--surface-primary, #181614)",
                  color: "var(--text-primary, #f5f2eb)",
                  border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
                  borderRadius: "8px",
                  fontSize: "14px",
                },
              }}
            />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<Authentication />} />
              <Route path="/login" element={<Authentication />} />
              <Route path="/register" element={<Authentication />} />
              <Route path="/verify-email" element={<Authentication />} />
              <Route path="/home" element={<HomeComponent />} />
              <Route path="/history" element={<HistoryComponent />} />
              <Route path="/:url" element={<VideoMeetComponent />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
