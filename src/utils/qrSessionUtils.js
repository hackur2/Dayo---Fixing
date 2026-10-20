import { STORAGE_KEYS } from "../constants/storageKeys";

export const QR_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
let pendingQrTokenRequest;

export function buildCustomerQrUrl(origin = window.location.origin) {
  const configuredOrigin = import.meta.env.VITE_CUSTOMER_QR_ORIGIN || origin;
  const accessUrl = new URL("/customer/menu", configuredOrigin);
  accessUrl.searchParams.set("scan", "1");
  return accessUrl.toString();
}

export function buildQrAccessUrl(qrToken, origin = window.location.origin) {
  const accessUrl = new URL("/customer/access", origin);
  accessUrl.searchParams.set("token", String(qrToken || "").trim());
  return accessUrl.toString();
}

export function requestNewQrSessionToken(supabaseClient) {
  if (!pendingQrTokenRequest) {
    pendingQrTokenRequest = supabaseClient
      .rpc("create_customer_qr_session")
      .then(({ data, error }) => {
        if (error) throw error;
        const token = typeof data === "string" ? data : data?.create_customer_qr_session;
        if (!token) throw new Error("Supabase did not return a session token.");
        return token;
      })
      .finally(() => {
        pendingQrTokenRequest = null;
      });
  }

  return pendingQrTokenRequest;
}

export function saveQrSession(qrToken) {
  const normalizedToken = String(qrToken || "").trim();

  if (!normalizedToken) {
    return null;
  }

  const grantedAtMs = Date.now();

  const session = {
    qrToken: normalizedToken,
    accessGrantedAt: new Date(grantedAtMs).toISOString(),
    expiresAt: new Date(grantedAtMs + QR_SESSION_DURATION_MS).toISOString(),
  };

  localStorage.setItem(
    STORAGE_KEYS.QR_SESSION,
    JSON.stringify(session)
  );

  return session;
}

export function getValidQrSession() {
  const storedSession = localStorage.getItem(STORAGE_KEYS.QR_SESSION);

  if (!storedSession) {
    return null;
  }

  try {
    const session = JSON.parse(storedSession);
    const expirationTime = new Date(session?.expiresAt).getTime();
    const hasValidToken = typeof session?.qrToken === "string" && session.qrToken.trim() !== "";
    const hasValidExpiration = Number.isFinite(expirationTime);

    if (!hasValidToken || !hasValidExpiration || Date.now() >= expirationTime) {
      clearQrSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error("Unable to read QR access session:", error);
    clearQrSession();
    return null;
  }
}

export function clearQrSession() {
  localStorage.removeItem(STORAGE_KEYS.QR_SESSION);
}
