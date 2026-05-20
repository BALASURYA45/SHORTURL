import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import LandingPage from "./pages/Landing.jsx";
import LoginPage from "./pages/Login.jsx";
import SignupPage from "./pages/Signup.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import LinkAnalyticsPage from "./pages/LinkAnalytics.jsx";
import ScanPage from "./pages/Scan.jsx";
import PublicStatsPage from "./pages/PublicStats.jsx";
import BulkPage from "./pages/Bulk.jsx";
import ProfilePage from "./pages/Profile.jsx";
import { getToken } from "./lib/auth.js";
import RequireAuth from "./components/RequireAuth.jsx";
import AppShell from "./components/AppShell.jsx";

function HomeRedirect() {
  return <LandingPage />;
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
        path="/scan"
        element={
          <RequireAuth>
            <AppShell>
              <ScanPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route path="/stats/:slug" element={<PublicStatsPage />} />
      <Route
        path="/dashboard/bulk"
        element={
          <RequireAuth>
            <AppShell>
              <BulkPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/links/:id"
        element={
          <RequireAuth>
            <AppShell>
              <LinkAnalyticsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/profile"
        element={
          <RequireAuth>
            <AppShell>
              <ProfilePage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
