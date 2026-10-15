import { createContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import SERVER_URL from "../environment";

export const AuthContext = createContext({});

const client = axios.create({
  baseURL: `${SERVER_URL}/api/v1/users`,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState(
    localStorage.getItem("pending_verify_email") || ""
  );

  const navigate = useNavigate();

  // Attach token header dynamically
  const getAuthHeader = () => {
    const activeToken = token || localStorage.getItem("token");
    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
  };

  // Session restoration
  const restoreSession = useCallback(async () => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await client.get("/me", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (response.data && response.data.user) {
        setUser(response.data.user);
        setToken(savedToken);
      } else {
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.warn("Session restoration failed:", err?.response?.data?.message || err.message);
      localStorage.removeItem("token");
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const handleRegister = async (name, email, password, acceptTerms) => {
    try {
      const res = await client.post("/register", {
        name,
        email,
        password,
        acceptTerms,
      });

      if (res.data && res.data.email) {
        setPendingVerifyEmail(res.data.email);
        localStorage.setItem("pending_verify_email", res.data.email);
      }
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const handleVerifyEmail = async (email, code) => {
    try {
      const res = await client.post("/verify-email", { email, code });
      localStorage.removeItem("pending_verify_email");
      setPendingVerifyEmail("");
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const handleResendVerification = async (email) => {
    try {
      const res = await client.post("/resend-verification", { email });
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const res = await client.post("/login", { email, password });
      if (res.data && res.data.token) {
        const authToken = res.data.token;
        localStorage.setItem("token", authToken);
        setToken(authToken);
        setUser(res.data.user);
        navigate("/home");
        return res.data;
      }
    } catch (err) {
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await client.post("/logout", {}, { headers: getAuthHeader() });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      navigate("/auth");
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      const activeToken = token || localStorage.getItem("token");
      const res = await client.post(
        "/add_to_activity",
        { token: activeToken, meeting_code: meetingCode },
        { headers: getAuthHeader() }
      );
      return res.data;
    } catch (err) {
      console.error("Error adding to activity history:", err);
      throw err;
    }
  };

  const getHistoryOfUser = async () => {
    try {
      const activeToken = token || localStorage.getItem("token");
      const res = await client.get(`/get_all_activity?token=${activeToken}`, {
        headers: getAuthHeader(),
      });
      return res.data;
    } catch (err) {
      console.error("Error fetching user activity history:", err);
      throw err;
    }
  };

  const deleteUserHistoryItem = async (meetingId) => {
    try {
      const activeToken = token || localStorage.getItem("token");
      const res = await client.post(
        `/delete_activity/${meetingId}`,
        { token: activeToken, meetingId },
        { headers: getAuthHeader() }
      );
      return res.data;
    } catch (err) {
      console.error("Error deleting history item:", err);
      throw err;
    }
  };

  const clearAllUserHistory = async () => {
    try {
      const activeToken = token || localStorage.getItem("token");
      const res = await client.post(
        "/clear_activity",
        { token: activeToken },
        { headers: getAuthHeader() }
      );
      return res.data;
    } catch (err) {
      console.error("Error clearing user history:", err);
      throw err;
    }
  };

  const data = {
    user,
    userData: user,
    token,
    isAuthenticated: !!user,
    isLoading,
    pendingVerifyEmail,
    setPendingVerifyEmail,
    handleRegister,
    handleVerifyEmail,
    handleResendVerification,
    handleLogin,
    handleLogout,
    restoreSession,
    addToUserHistory,
    getHistoryOfUser,
    deleteUserHistoryItem,
    clearAllUserHistory,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
