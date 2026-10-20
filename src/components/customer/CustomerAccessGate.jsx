import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { CUSTOMER_ROUTES } from "../../constants/routes";
import {
  clearQrSession,
  getValidQrSession,
  requestNewQrSessionToken,
  saveQrSession,
} from "../../utils/qrSessionUtils";
import { supabase } from "../../lib/supabase";

function CustomerAccessGate({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isQrScan = new URLSearchParams(location.search).get("scan") === "1";
  const [hasValidSession, setHasValidSession] = useState(() =>
    Boolean(getValidQrSession())
  );
  const [qrScanResult, setQrScanResult] = useState({ key: "", error: "" });
  const isStartingQrSession = isQrScan && qrScanResult.key !== location.key;
  const qrSessionError = qrScanResult.key === location.key ? qrScanResult.error : "";

  useEffect(() => {
    let isCurrent = true;

    if (isQrScan) {
      async function startScannedSession() {
        try {
          if (!supabase) throw new Error("Customer ordering is not configured.");
          const token = await requestNewQrSessionToken(supabase);
          saveQrSession(token);
          if (!isCurrent) return;

          setHasValidSession(true);
          setQrScanResult({ key: location.key, error: "" });
          navigate(location.pathname, { replace: true });
        } catch (error) {
          console.error("Unable to create customer QR session:", error);
          if (!isCurrent) return;
          setHasValidSession(false);
          setQrScanResult({
            key: location.key,
            error: error.message?.includes("create_customer_qr_session")
              ? "Customer QR session setup is missing in Supabase. Apply the customer QR scan session migration."
              : "Could not start your customer session. Please scan the QR again or ask staff for help.",
          });
        }
      }

      startScannedSession();
      return () => { isCurrent = false; };
    }

    const session = getValidQrSession();

    if (!session) {
      return () => { isCurrent = false; };
    }

    const expirationTime = new Date(session.expiresAt).getTime();
    const remainingTime = Math.max(0, expirationTime - Date.now());

    const expirationTimer = window.setTimeout(() => {
      clearQrSession();
      setHasValidSession(false);
    }, remainingTime);

    return () => {
      isCurrent = false;
      window.clearTimeout(expirationTimer);
    };
  }, [isQrScan, location.key, location.pathname, location.search, navigate]);

  if (isStartingQrSession) {
    return <main className="customer-access-page"><section className="customer-access-card">Connecting you to the menu…</section></main>;
  }

  if (qrSessionError) {
    return <main className="customer-access-page"><section className="customer-access-card" role="alert">{qrSessionError}</section></main>;
  }

  if (!hasValidSession) {
    return (
      <Navigate
        to={CUSTOMER_ROUTES.ACCESS}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}

export default CustomerAccessGate;
