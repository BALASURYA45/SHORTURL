import { Home, Link2, LogOut, QrCode, Sparkles, Upload, UserCircle2 } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../lib/auth.js";
import { cn } from "../lib/utils.js";
import ThemeToggle from "./ThemeToggle.jsx";
import { Button } from "./ui/button.jsx";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/dashboard/bulk", label: "Bulk CSV", icon: Upload },
  { to: "/scan", label: "Scan QR", icon: QrCode },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle2 }
];

export default function AppShell({ children }) {
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r bg-card/40 p-4 md:block">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Link2 className="h-4 w-4 -rotate-[36deg]" />
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-background text-primary shadow">
                  <Sparkles className="h-3 w-3" />
                </span>
              </div>
              <span>SHORTURO</span>
            </div>
            <ThemeToggle />
          </div>

          <nav className="mt-6 grid gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      isActive ? "bg-accent text-accent-foreground" : null
                    )
                  }
                  end
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>



          <div className="mt-6">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-card/40 px-4 py-3 md:hidden">
            <div className="flex items-center gap-2 font-semibold">
              <Link2 className="h-4 w-4 -rotate-[36deg] text-primary" />
              SHORTURO
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
            {children || <Outlet />}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-7xl grid-cols-4">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs text-muted-foreground",
                        isActive ? "text-foreground" : null
                      )
                    }
                    end
                  >
                    <Icon className={cn("h-5 w-5", item.to === "/scan" ? "text-teal-600" : null)} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
