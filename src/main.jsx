import { ClerkProvider } from "@clerk/react";
import React from "react";
import { createRoot } from "react-dom/client";
import AccountWorkspace from "./AccountWorkspace.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/app/">
      <AccountWorkspace />
    </ClerkProvider>
  </React.StrictMode>,
);
