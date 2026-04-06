import "./styles.css";
import { initializeApp } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root not found.");
}

initializeApp(root);

