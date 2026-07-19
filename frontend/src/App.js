import "./App.css";
import { AuthProvider } from "./contexts/AuthContext";
import Authentication from "./pages/authentication";
import LandingPage from "./pages/landing";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

function App() {
  return (
    <>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Authentication />} />
          </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;
