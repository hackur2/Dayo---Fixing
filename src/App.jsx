import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import AppRoutes from "./routes/AppRoutes";
import AddToHomeScreenPrompt from "./components/customer/AddToHomeScreenPrompt";

function App() {
  const location = useLocation();
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Unable to register DaYo service worker:", error);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return (
    <>
      <AppRoutes />
      <AddToHomeScreenPrompt
        key={location.pathname}
        isCustomerMenu={location.pathname === "/customer/menu"}
        installPromptEvent={installPromptEvent}
        isInstalled={isInstalled}
        onPromptConsumed={() => setInstallPromptEvent(null)}
      />
    </>
  );
}

export default App;
