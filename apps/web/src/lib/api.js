import axios from "axios";
import SERVER_URL from "../environment";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  `${SERVER_URL}/api/v1/users`;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise = null;

export const getRefreshPromise = () => refreshPromise;
export const resetRefreshPromise = () => {
  refreshPromise = null;
};

// Request interceptor injecting Authorization: Bearer <accessToken>
api.interceptors.request.use((config) => {
  const activeToken =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (activeToken) {
    config.headers.Authorization = `Bearer ${activeToken}`;
  }
  return config;
});

// Response interceptor: on 401, attempt refresh via /api/v1/users/refresh, retry once
api.interceptors.response.use(
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
      return api(originalRequest);
    } catch (refreshErr) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/auth"
      ) {
        window.location.href = "/login";
      }
      return Promise.reject(refreshErr);
    }
  }
);

// Typed helpers: api.get, api.post, api.put, api.delete
api.getHelper = (url, config) => api.get(url, config);
api.postHelper = (url, data, config) => api.post(url, data, config);
api.putHelper = (url, data, config) => api.put(url, data, config);
api.deleteHelper = (url, config) => api.delete(url, config);

export default api;
