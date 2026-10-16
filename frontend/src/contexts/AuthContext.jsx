import { createContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import SERVER_URL from "../environment";

export const AuthContext = createContext({});

export const client = axios.create({
  baseURL: `${SERVER_URL}/api/v1/users`,
});

// Amendment 5: Module-level singleton refresh promise to prevent thundering herds
let refreshPromise = null;

export const getRefreshPromise = () => refreshPromise;
export const resetRefreshPromiseForTests = () => {
  refreshPromise = null;
};

// Request interceptor: dynamically attaches Authorization header from storage
client.interceptors.request.use((config) => {
  const activeToken =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (activeToken) {
    config.headers.Authorization = `Bearer ${activeToken}`;
  }
  return config;
});

// Response interceptor: on 401, dedupes /refresh calls via singleton promise
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      !error.response ||
      error.response.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on auth endpoints
    const url = originalRequest.url || "";
    if (
      url.includes("/login") ||
      url.includes("/register") ||
      url.includes("/verify-email") ||
      url.includes("/resend-verification") ||
      url.includes("/refresh") ||
      url.includes("/logout")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const storedRefreshToken = localStorage.getItem("refreshToken");
        if (!storedRefreshToken) {
          throw new Error("No refresh token available");
        }
        const res = await axios.post(`${SERVER_URL}/api/v1/users/refresh`, {
          refreshToken: storedRefreshToken,
        });
        const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
        localStorage.setItem("accessToken", newAccess);
        localStorage.setItem("token", newAccess);
        if (newRefresh) {
          localStorage.setItem("refreshToken", newRefresh);
        }
        return { accessToken: newAccess, refreshToken: newRefresh };
      })().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      const { accessToken: newAccessToken } = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return client(originalRequest);
    } catch (refreshErr) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
      return Promise.reject(refreshErr);
    }
  }
);

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
