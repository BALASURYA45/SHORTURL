import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "./pages/Login.jsx";
import SignupPage from "./pages/Signup.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import { getToken } from "./lib/auth.js";
import RequireAuth from "./components/RequireAuth.jsx";

function HomeRedirect() {
  return <Navigate to={getToken() ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    function onAuth() {
      if (!getToken()) navigate("/login", { replace: true });
    }
    window.addEventListener("shorturo:auth", onAuth);
    return () => window.removeEventListener("shorturo:auth", onAuth);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
