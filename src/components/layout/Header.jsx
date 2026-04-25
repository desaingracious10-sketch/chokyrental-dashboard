import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, Bell, Car, CalendarDays, Users, FileText, Moon, Sun } from "lucide-react";
import { format } from "date-fns";
import { useAppContext } from "../../context/AppContext";
import { useNotifications } from "../../hooks/useNotifications";

const ROUTE_TITLES = {
  "/": "Dashboard",
  "/fleet": "Armada",
  "/bookings": "Booking",
  "/gps": "GPS Tracking",
  "/finance": "Keuangan",
  "/invoice": "Invoice",
  "/drivers": "Sopir",
  "/maintenance": "Maintenance",
  "/customers": "Pelanggan",
  "/analytics": "Analytics",
};

export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, theme, toggleTheme } = useAppContext();
  const { notifications, totalCount } = useNotifications();
  const [now, setNow] = useState(new Date());
  const [query, setQuery] = useState("");
  const [openResults, setOpenResults] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function openSearch() {
      inputRef.current?.focus();
      setOpenResults(true);
    }

    function closeSearch() {
      setOpenResults(false);
    }

    window.addEventListener("app:open-search", openSearch);
    window.addEventListener("app:escape", closeSearch);
    return () => {
      window.removeEventListener("app:open-search", openSearch);
      window.removeEventListener("app:escape", closeSearch);
    };
  }, []);

  const title = ROUTE_TITLES[pathname] ?? "Dashboard";

  const searchGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];

    const groups = [
      {
        key: "vehicles",
        icon: Car,
        emoji: "🚗",
        label: "Kendaraan",
        items: state.vehicles
          .filter((vehicle) => `${vehicle.name} ${vehicle.plate}`.toLowerCase().includes(term))
          .slice(0, 4)
          .map((vehicle) => ({
            id: vehicle.id,
            title: vehicle.name,
            subtitle: vehicle.plate,
            path: `/fleet?vehicleId=${vehicle.id}`,
          })),
      },
      {
        key: "bookings",
        icon: CalendarDays,
        emoji: "📅",
        label: "Booking",
        items: state.bookings
          .filter((booking) => {
            const customer = state.customers.find((item) => item.id === booking.customerId);
            return `${booking.id} ${customer?.name ?? ""}`.toLowerCase().includes(term);
          })
          .slice(0, 4)
          .map((booking) => {
            const customer = state.customers.find((item) => item.id === booking.customerId);
            return {
              id: booking.id,
              title: booking.id,
              subtitle: customer?.name ?? "-",
              path: `/bookings?bookingId=${booking.id}`,
            };
          }),
      },
      {
        key: "customers",
        icon: Users,
        emoji: "👥",
        label: "Customer",
        items: state.customers
          .filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(term))
          .slice(0, 4)
          .map((customer) => ({
            id: customer.id,
            title: customer.name,
            subtitle: customer.phone,
            path: `/customers?customerId=${customer.id}`,
          })),
      },
      {
        key: "invoices",
        icon: FileText,
        emoji: "📄",
        label: "Invoice",
        items: state.invoices
          .filter((invoice) => `${invoice.invoiceNo} ${invoice.customer?.name ?? ""}`.toLowerCase().includes(term))
          .slice(0, 4)
          .map((invoice) => ({
            id: invoice.id,
            title: invoice.invoiceNo,
            subtitle: invoice.customer?.name ?? "-",
            path: `/invoice?invoiceId=${invoice.id}`,
          })),
      },
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [query, state.bookings, state.customers, state.invoices, state.vehicles]);

  function goToResult(path) {
    navigate(path);
    setOpenResults(false);
    setQuery("");
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <nav className="text-xs text-slate-500 hidden sm:block">
            <span>Choky Rental</span>
            <span className="mx-1.5">/</span>
            <span className="text-navy font-medium">{title}</span>
          </nav>
          <h1 className="text-base sm:text-lg font-bold text-navy leading-tight">
            {title}
          </h1>
        </div>

        <div className="relative hidden md:block">
          <div className="flex items-center bg-slate-100 rounded-lg px-3 h-9 w-72">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onFocus={() => setOpenResults(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpenResults(true);
              }}
              placeholder="Cari booking, customer, plat..."
              className="bg-transparent border-0 outline-none text-sm ml-2 w-full text-slate-700 placeholder:text-slate-400"
            />
          </div>
          {openResults && searchGroups.length ? (
            <div className="absolute right-0 mt-2 w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
              {searchGroups.map((group) => (
                <div key={group.key} className="border-b border-slate-100 last:border-b-0">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                    {group.emoji} {group.label}
                  </div>
                  <div className="p-2">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => goToResult(item.path)}
                        className="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="hidden lg:flex flex-col items-end leading-tight">
          <span className="text-xs text-slate-500">
            {format(now, "EEEE, dd MMM yyyy")}
          </span>
          <span className="text-sm font-semibold text-navy tabular-nums">
            {format(now, "HH:mm:ss")}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          onClick={() => notifications[0] && navigate(notifications[0].path)}
          aria-label="Notifikasi"
        >
          <Bell className="w-5 h-5" />
          {totalCount ? (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {totalCount}
            </span>
          ) : null}
        </button>

        <img
          src="https://ui-avatars.com/api/?name=Zainal+Candra&background=0d1f4e&color=fff&bold=true"
          alt="Zainal Candra"
          className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200"
        />
      </div>
    </header>
  );
}
