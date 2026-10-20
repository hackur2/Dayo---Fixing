import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { buildCustomerQrUrl } from "../../utils/qrSessionUtils";

import "../../styles/superAdminQrAccess.css";

function SuperAdminQrAccessPage() {
  const [statusMessage, setStatusMessage] = useState("");
  const customerUrl = buildCustomerQrUrl();

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(customerUrl);
      setStatusMessage("Customer link copied.");
    } catch {
      setStatusMessage("Select and copy the customer link shown below.");
    }
  }

  function handleDownloadQr() {
    const svg = document.querySelector("#customer-access-qr svg");
    if (!svg) return;

    const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "dayo-customer-qr.svg";
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <section className="admin-page super-admin-qr-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Super Admin</p>
          <h1>Customer QR</h1>
          <p>Print this fixed QR code for customers to scan.</p>
        </div>
      </div>

      <section className="super-admin-qr-preview fixed-customer-qr" aria-label="Fixed customer QR code">
        <div id="customer-access-qr">
          <QRCodeSVG value={customerUrl} size={320} level="H" includeMargin />
        </div>
        <strong>DaYo Customer Ordering</strong>
        <p>Every scan creates a fresh customer session on the phone that scanned it.</p>
        <div className="super-admin-qr-actions">
          <button type="button" onClick={handleDownloadQr}>Download QR</button>
          <button type="button" onClick={handleCopyLink}>Copy link</button>
        </div>
        <input
          className="super-admin-qr-url"
          aria-label="Customer QR link"
          readOnly
          value={customerUrl}
          onFocus={(event) => event.currentTarget.select()}
        />
        {statusMessage && <p className="super-admin-qr-status" role="status">{statusMessage}</p>}
        <p className="super-admin-qr-note">
          Use a public website address or a network-accessible address. A localhost
          link only opens on the computer running the app.
        </p>
      </section>
    </section>
  );
}

export default SuperAdminQrAccessPage;
