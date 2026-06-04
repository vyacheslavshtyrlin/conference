import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";

import { ColorSchemeScript } from "@mantine/core";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <BrowserRouter>
    <ColorSchemeScript defaultColorScheme="light" />
    <App />
  </BrowserRouter>
);
