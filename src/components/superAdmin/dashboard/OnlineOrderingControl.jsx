import { useLocalOnlineOrderingControl } from "../../../hooks/useLocalOnlineOrderingControl";

function formatTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Never";
  return new Intl.DateTimeFormat("en-PH", { timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value));
}

export default function OnlineOrderingControl() {
  const { status, error, isSaving, setEnabled } = useLocalOnlineOrderingControl();
  const enabled = Boolean(status?.manual_enabled);
  const localOnline = Boolean(status?.local_online);
  const canAccept = Boolean(status?.effective_enabled);

  return (
    <aside className="dashboard-online-ordering" aria-label="Online ordering control">
      <div className="dashboard-online-ordering-row">
        <div>
          <strong>Online ordering</strong>
          <p>{canAccept ? "Accepting Vercel orders" : "Not accepting Vercel orders"}</p>
        </div>
        <button
          type="button"
          className={`dashboard-ordering-toggle${enabled ? " enabled" : ""}`}
          onClick={() => void setEnabled(!enabled)}
          disabled={!status || isSaving}
          aria-pressed={enabled}
        >
          {isSaving ? "Saving…" : enabled ? "ON" : "OFF"}
        </button>
      </div>
      <p className={localOnline ? "dashboard-ordering-status online" : "dashboard-ordering-status offline"}>
        Local Docker: <strong>{localOnline ? "Online" : "Offline"}</strong>
      </p>
      <p>Last confirmed by cloud: <strong>{formatTime(status?.last_cloud_report_at)}</strong></p>
      {error && <p className="dashboard-ordering-status offline" role="alert">{error}</p>}
    </aside>
  );
}
