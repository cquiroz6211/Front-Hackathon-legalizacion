import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@comfama/comfama-ui-react";
import "./styles/index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider defaultPosition="bottom-right">
      <App />
    </ToastProvider>
  </StrictMode>,
);
