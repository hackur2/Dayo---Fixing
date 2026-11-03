// Docker's local-admin build sets this explicitly. Cloud/Vercel builds default
// to "cloud" so local-only operational controls are never rendered there.
export const isLocalDeployment = import.meta.env.VITE_DEPLOYMENT_MODE === "local";
