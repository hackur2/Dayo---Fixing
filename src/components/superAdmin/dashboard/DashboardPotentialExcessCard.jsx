import PotentialExcessCard from "../inventory/PotentialExcessCard";

export default function DashboardPotentialExcessCard({ estimate, isUnavailable, isLoading }) {
  return (
    <PotentialExcessCard estimate={estimate} isUnavailable={isUnavailable} isLoading={isLoading} className="dashboard-panel dashboard-insight-card dashboard-excess-card" />
  );
}
