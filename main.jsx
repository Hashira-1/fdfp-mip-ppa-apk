import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";          // Tailwind, compilé au build (plus de CDN)
import MipPpaApp from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MipPpaApp />
  </React.StrictMode>
);
