import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import FormErrorMessage from "../../components/common/FormErrorMessage";
import { authenticateUser } from "../../services/authService";
import {
  getRoleHomeRoute,
  getSafeRedirectPath,
} from "../../utils/authRouteUtils";
import { getStoredAuthUser, saveAuthUser } from "../../utils/authUtils";

import "../../styles/login.css";

const INITIAL_LOGIN_FORM = {
  email: "",
  password: "",
};

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_LOGIN_FORM);
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const currentUser = getStoredAuthUser();

    if (!currentUser) {
      return;
    }

    navigate(getRoleHomeRoute(currentUser.role), { replace: true });
  }, [navigate]);

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setLoginError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const email = formData.email.trim();
    const password = formData.password.trim();

    if (!email || !password) {
      setLoginError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    setLoginError("");

    try {
      const authenticatedUser = await authenticateUser({
        email,
        password,
      });

      if (!authenticatedUser) {
        setLoginError(
            "Invalid account. Please check your email and password."
        );
        return;
      }

      saveAuthUser(authenticatedUser);

      const requestedPath = location.state?.from;
      const redirectPath = getSafeRedirectPath(
        authenticatedUser.role,
        requestedPath
      );

      navigate(redirectPath, { replace: true });
    } catch (error) {
      console.error("Unable to log in:", error);
      setLoginError("Unable to log in right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span>DaYo!</span>
          <h1>Login</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field" htmlFor="login-email">
            <span>Email</span>
            <input
              id="login-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email"
              autoComplete="username"
              disabled={isSubmitting}
            />
          </label>

          <label className="login-field" htmlFor="login-password">
            <span>Password</span>
            <input
              id="login-password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter password"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </label>

          <FormErrorMessage message={loginError} />

          <button
            type="submit"
            className="login-submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
