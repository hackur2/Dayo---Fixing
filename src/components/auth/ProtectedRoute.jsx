import { Navigate, useLocation } from "react-router";

import { AUTH_ROUTES } from "../../constants/routes";
import { getRoleHomeRoute, isRouteAllowedForUser } from "../../utils/authRouteUtils";
import { useAuthenticatedUser } from "../../hooks/useAuthenticatedUser";

function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation();
  const { user: currentUser, isLoading } = useAuthenticatedUser();

  if (isLoading) {
    return <p role="status">Checking your session...</p>;
  }

  if (!currentUser) {
    return (
      <Navigate
        to={AUTH_ROUTES.LOGIN}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!allowedRoles.includes(currentUser.role) || !isRouteAllowedForUser(currentUser, location.pathname)) {
    return <Navigate to={getRoleHomeRoute(currentUser)} replace />;
  }

  return children;
}

export default ProtectedRoute;
