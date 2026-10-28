import axios from "axios";

/**
 * Creates a framework-agnostic HTTP API client with automatic token injection
 * and token refresh deduplication.
 *
 * @param {Object} options
 * @param {string} options.baseURL - Root URL for API requests.
 * @param {() => string | Promise<string> | null} [options.getToken] - Function returning active access token.
 * @param {() => string | Promise<string> | null} [options.getRefreshToken] - Function returning refresh token.
 * @param {(tokens: { accessToken: string, refreshToken: string }) => void | Promise<void>} [options.onTokenRefresh] - Callback when refresh succeeds.
 * @param {() => void | Promise<void>} [options.onAuthFailure] - Callback when refresh fails or session expires.
 * @returns {import("axios").AxiosInstance}
 */
export function createApiClient({
  baseURL,
  getToken = () => null,
  getRefreshToken = () => null,
  onTokenRefresh = () => {},
  onAuthFailure = () => {},
}) {
  const instance = axios.create({
    baseURL,
  });

  let refreshPromise = null;

  // Request interceptor: injects Bearer token
  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: handles 401 and token refresh
  instance.interceptors.response.use(
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
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            throw new Error("No refresh token available");
          }
          const refreshUrl = baseURL.endsWith("/")
            ? `${baseURL}refresh`
            : `${baseURL}/refresh`;

          const res = await axios.post(refreshUrl, { refreshToken });
          const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
          await onTokenRefresh({ accessToken: newAccess, refreshToken: newRefresh });
          return { accessToken: newAccess, refreshToken: newRefresh };
        })().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        const { accessToken: newAccessToken } = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return instance(originalRequest);
      } catch (refreshErr) {
        await onAuthFailure();
        return Promise.reject(refreshErr);
      }
    }
  );

  return instance;
}

export default createApiClient;
