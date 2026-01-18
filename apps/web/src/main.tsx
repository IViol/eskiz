import React from "react";
import ReactDOM from "react-dom/client";
import { Router } from "./app/router";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
