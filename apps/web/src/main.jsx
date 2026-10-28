import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

if (import.meta.env.DEV) {
  import("@axe-core/react")
    .then(({ default: axe }) => {
      axe(React, ReactDOM, 1000);
    })
    .catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
