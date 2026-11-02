import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { clearAuthUser, getStoredAuthUser } from "../utils/authUtils";
import { restoreSessionUser } from "../utils/sessionUtils";

export function useAuthenticatedUser() {
  const [authState, setAuthState] = useState({
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;
    let signedOut = false;
    const { data: listener } = supabase?.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;

      signedOut = true;
      clearAuthUser();
      if (!cancelled) setAuthState({ user: null, isLoading: false });
    }) ?? {};

    restoreSessionUser(supabase?.auth, getStoredAuthUser())
      .then((user) => {
        if (cancelled || signedOut) return;

        if (!user) clearAuthUser();
        setAuthState({ user, isLoading: false });
      })
      .catch((error) => {
        if (cancelled) return;

        console.error("Unable to restore admin session:", error.message);
        clearAuthUser();
        setAuthState({ user: null, isLoading: false });
      });

    return () => {
      cancelled = true;
      listener?.subscription.unsubscribe();
    };
  }, []);

  return authState;
}
