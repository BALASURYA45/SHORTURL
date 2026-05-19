import { useNavigate } from "react-router-dom";
import { logout } from "../lib/auth.js";

export default function DashboardPage() {
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">SHORTURO</div>
        <button className="buttonSmall" type="button" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="content">
        <div className="card">
          <h1 className="title">Dashboard</h1>
          <p className="muted">Next: create short URL + list links + delete + analytics page.</p>
        </div>
      </main>
    </div>
  );
}

