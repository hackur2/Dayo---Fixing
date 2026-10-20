import { useEffect, useState } from "react";

const DISMISSED_PROMPT_KEY = "dayo_home_screen_prompt_dismissed";

function isRunningStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isPhone() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia?.("(max-width: 760px)").matches;
}

function AddToHomeScreenPrompt({
  isCustomerMenu,
  installPromptEvent,
  isInstalled,
  onPromptConsumed,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ios = isIosDevice();
  const isLocalHttp = location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(location.hostname);

  useEffect(() => {
    if (!isCustomerMenu || isInstalled || isRunningStandalone() || !isPhone()) {
      return undefined;
    }

    try {
      if (sessionStorage.getItem(DISMISSED_PROMPT_KEY) === "true") return undefined;
    } catch {
      // Continue showing the prompt when session storage is unavailable.
    }

    const timer = window.setTimeout(() => setIsOpen(true), 1100);
    return () => window.clearTimeout(timer);
  }, [isCustomerMenu, isInstalled]);

  function dismissPrompt() {
    try {
      sessionStorage.setItem(DISMISSED_PROMPT_KEY, "true");
    } catch {
      // The close button remains usable without browser storage.
    }
    setIsOpen(false);
  }

  async function handleInstall() {
    if (!installPromptEvent) return;

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    onPromptConsumed();
    if (choice.outcome === "accepted") setIsOpen(false);
  }

  if (!isOpen || !isCustomerMenu || isInstalled || isRunningStandalone() || !isPhone()) return null;

  return (
    <div className="home-screen-prompt-backdrop" role="presentation" onClick={dismissPrompt}>
          <section
            className="home-screen-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-screen-prompt-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="home-screen-prompt-close"
              aria-label="Close Add to Home Screen prompt"
              onClick={dismissPrompt}
            >
              ×
            </button>
            <img src="/images/pwa/dayo-icon-192.png" alt="" width="56" height="56" />
            <p className="home-screen-prompt-eyebrow">DaYo! Customer Menu</p>
            <h2 id="home-screen-prompt-title">Add DaYo! to your Home Screen</h2>
            <p className="home-screen-prompt-description">
              Add a shortcut so you can open the customer menu quickly next time.
            </p>

            {installPromptEvent ? (
              <button type="button" className="home-screen-prompt-install" onClick={handleInstall}>
                Install DaYo!
              </button>
            ) : (
              <div className="home-screen-prompt-steps">
                <strong>{ios ? "On iPhone or iPad" : "On Android"}</strong>
                <p>
                  {ios
                    ? "Tap Share, then choose Add to Home Screen."
                    : "Tap the browser menu ⋮, then choose Add to Home screen or Install app."}
                </p>
                {isLocalHttp && (
                  <p className="home-screen-prompt-note">
                    This local network address uses HTTP, so the browser may offer a shortcut instead of a full app install. Full PWA installation requires HTTPS.
                  </p>
                )}
              </div>
            )}

            <button type="button" className="home-screen-prompt-later" onClick={dismissPrompt}>
              Maybe later
            </button>
          </section>
    </div>
  );
}

export default AddToHomeScreenPrompt;
