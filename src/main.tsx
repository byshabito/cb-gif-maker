import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root not found.");
}

document.documentElement.classList.add("dark");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
