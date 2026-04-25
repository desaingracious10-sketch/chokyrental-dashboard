import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Breadcrumbs from "./Breadcrumbs";
import ToastViewport from "../ui/ToastViewport";
import { useAppContext } from "../../context/AppContext";

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function handleShortcut(event) {
      if (!event.ctrlKey && !event.metaKey) {
        if (event.key === "Escape") {
          window.dispatchEvent(new CustomEvent("app:escape"));
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("app:open-search"));
      }

      if (key === "b") {
        event.preventDefault();
        navigate("/bookings", { state: { openNewBooking: true } });
      }

      if (key === "i") {
        event.preventDefault();
        navigate("/invoice", { state: { openNewInvoice: true } });
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [navigate]);

  return (
    <div className={`min-h-screen bg-slate-100 text-slate-800 transition-colors duration-300 ${theme === "dark" ? "theme-dark" : ""}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="md:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">
          <Breadcrumbs />
          <div key={pathname} className="animate-page-fade">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastViewport />
    </div>
  );
}
