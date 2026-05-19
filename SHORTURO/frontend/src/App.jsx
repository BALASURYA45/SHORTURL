import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/Login.jsx";
import SignupPage from "./pages/Signup.jsx";
import { getToken } from "./lib/auth.js";

function HomeRedirect() {
  return <Navigate to={getToken() ? "/dashboard" : "/login"} replace />;
}

function DashboardPlaceholder() {
  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Dashboard</h1>
        <p className="muted">Next module: protected routes + links management UI.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/dashboard" element={<DashboardPlaceholder />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

