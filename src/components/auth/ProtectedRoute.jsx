import { Navigate, useLocation } from "react-router";

import { AUTH_ROUTES } from "../../constants/routes";
import { getRoleHomeRoute } from "../../utils/authRouteUtils";
import { getStoredAuthUser } from "../../utils/authUtils";

function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation();
  const currentUser = getStoredAuthUser();

  if (!currentUser) {
    return (
      <Navigate
        to={AUTH_ROUTES.LOGIN}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={getRoleHomeRoute(currentUser.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
