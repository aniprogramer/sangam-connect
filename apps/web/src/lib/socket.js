import { io } from "socket.io-client";
import SERVER_URL from "../environment";

let socket = null;

/**
 * Returns a singleton Socket.IO instance configured with exponential backoff
 * and Bearer token authentication in the connection handshake.
 *
 * @param {string} [token] - Optional JWT access token. Falls back to localStorage.
 * @returns {import("socket.io-client").Socket}
 */
export const getSocket = (token) => {
  const authToken =
    token ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    null;

  if (!socket) {
    socket = io(SERVER_URL, {
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      autoConnect: true,
    });
  } else if (authToken && socket.auth?.token !== authToken) {
    socket.auth = { token: authToken };
  }

  return socket;
};

/**
 * Disconnects and destroys the active socket singleton.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default getSocket;
