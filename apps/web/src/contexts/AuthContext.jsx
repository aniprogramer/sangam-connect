import { createContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { getRefreshPromise, resetRefreshPromise } from "../lib/api";

export const AuthContext = createContext({});

export const client = api;
export { getRefreshPromise };
export const resetRefreshPromiseForTests = resetRefreshPromise;


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    localStorage.getItem("accessToken") || localStorage.getItem("token") || null
  );
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken") || null
  );
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refreshToken") || null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState(
    localStorage.getItem("pending_verify_email") || ""
  );

  const navigate = useNavigate();

  // Session restoration
  const restoreSession = useCallback(async () => {
    const savedToken =
      localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (!savedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await client.get("/me");
      if (response.data && response.data.user) {
        setUser(response.data.user);
        setToken(savedToken);
        setAccessToken(savedToken);
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setUser(null);
        setToken(null);
        setAccessToken(null);
      }
    } catch (err) {
      console.warn("Session restoration failed:", err?.response?.data?.message || err.message);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      setUser(null);
      setToken(null);
      setAccessToken(null);
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
      if (res.data && (res.data.accessToken || res.data.token)) {
        const authToken = res.data.accessToken || res.data.token;
        const newRefreshToken = res.data.refreshToken || null;
        localStorage.setItem("accessToken", authToken);
        localStorage.setItem("token", authToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
          setRefreshToken(newRefreshToken);
        }
        setAccessToken(authToken);
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
    const currentRefreshToken =
      refreshToken || localStorage.getItem("refreshToken");
    try {
      await client.post("/logout", { refreshToken: currentRefreshToken });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      setAccessToken(null);
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      navigate("/auth");
    }
  };

  // Amendment 10: Strip token from history payloads
  const addToUserHistory = async (meetingCode) => {
    try {
      const res = await client.post("/add_to_activity", {
        meeting_code: meetingCode,
      });
      return res.data;
    } catch (err) {
      console.error("Error adding to activity history:", err);
      throw err;
    }
  };

  const getHistoryOfUser = async () => {
    try {
      const res = await client.get("/get_all_activity");
      return res.data;
    } catch (err) {
      console.error("Error fetching user activity history:", err);
      throw err;
    }
  };

  const deleteUserHistoryItem = async (meetingId) => {
    try {
      const res = await client.post(`/delete_activity/${meetingId}`, {
        meetingId,
      });
      return res.data;
    } catch (err) {
      console.error("Error deleting history item:", err);
      throw err;
    }
  };

  const clearAllUserHistory = async () => {
    try {
      const res = await client.post("/clear_activity");
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
    accessToken,
    refreshToken,
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
