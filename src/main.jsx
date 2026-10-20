import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App.jsx";

import "./styles/variables.css";
import "./styles/global.css";
import "./styles/homeScreenPrompt.css";
import "./styles/images.css";
import "./styles/buttons.css";
import "./styles/forms.css";
import "./styles/states.css";
import "./styles/customerLayout.css";
import "./styles/adminLayout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
