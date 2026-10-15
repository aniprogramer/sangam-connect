const IS_PROD = process.env.NODE_ENV === "production";

const SERVER_URL =
  process.env.REACT_APP_API_URL ||
  (IS_PROD
    ? "https://antarsetubackend.onrender.com"
    : "http://localhost:8050");

export default SERVER_URL;