import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  CalendarDays,
  MapPin,
  Wallet,
  FileText,
  UserCog,
  Wrench,
  Users,
  Bot,
  LogOut,
  X,
} from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { useAppContext } from "../../context/AppContext";

const menu = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/fleet", label: "Armada", icon: Car, badgeKey: "maintenanceCount" },
  { to: "/bookings", label: "Booking", icon: CalendarDays, badgeKey: "bookingCount" },
  { to: "/gps", label: "GPS Tracking", icon: MapPin },
  { to: "/finance", label: "Keuangan", icon: Wallet },
  { to: "/invoice", label: "Invoice", icon: FileText, badgeKey: "invoiceCount" },
  { to: "/drivers", label: "Sopir", icon: UserCog },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, badgeKey: "maintenanceCount" },
  { to: "/customers", label: "Pelanggan", icon: Users },
  { to: "/analytics", label: "Analytics", icon: Bot },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const notificationCounts = useNotifications();
  const { logout } = useAppContext();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy text-white flex flex-col transform transition-transform duration-200 md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-base">Choky Rental</p>
            <p className="text-[11px] text-white/60">Command Center</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-white/70 hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal text-white shadow-sm"
                    : "text-white/75 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {notificationCounts[item.badgeKey] ? (
                <span className="text-[11px] font-semibold bg-red-500 text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {notificationCounts[item.badgeKey]}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <img
            src="https://ui-avatars.com/api/?name=Zainal+Candra&background=00b8a9&color=fff&bold=true"
            alt="Zainal Candra"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Zainal Candra</p>
            <p className="text-[11px] text-white/60 truncate">Owner</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="p-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
