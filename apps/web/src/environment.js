const IS_PROD = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.PROD : false;

const SERVER_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  (IS_PROD
    ? "https://antarsetubackend.onrender.com"
    : "http://localhost:8002");

export default SERVER_URL;