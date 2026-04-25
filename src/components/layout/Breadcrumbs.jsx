import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

const LABELS = {
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

export default function Breadcrumbs() {
  const { pathname, search } = useLocation();
  const { state } = useAppContext();
  const params = new URLSearchParams(search);
  const items = [{ label: "Dashboard", path: "/" }];

  if (pathname !== "/") {
    items.push({ label: LABELS[pathname] ?? "Halaman", path: pathname });
  }

  if (pathname === "/fleet" && params.get("vehicleId")) {
    const vehicle = state.vehicles.find((item) => item.id === params.get("vehicleId"));
    if (vehicle) items.push({ label: `Detail ${vehicle.name}`, path: `${pathname}${search}` });
  }

  if (pathname === "/bookings" && params.get("bookingId")) {
    const booking = state.bookings.find((item) => item.id === params.get("bookingId"));
    if (booking) items.push({ label: `Detail ${booking.id}`, path: `${pathname}${search}` });
  }

  if (pathname === "/customers" && params.get("customerId")) {
    const customer = state.customers.find((item) => item.id === params.get("customerId"));
    if (customer) items.push({ label: customer.name, path: `${pathname}${search}` });
  }

  if (pathname === "/invoice" && params.get("invoiceId")) {
    const invoice = state.invoices.find((item) => item.id === params.get("invoiceId"));
    if (invoice) items.push({ label: invoice.invoiceNo, path: `${pathname}${search}` });
  }

  return (
    <nav className="no-print mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <Home className="h-4 w-4" />
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <ChevronRight className="h-4 w-4 text-slate-300" /> : null}
          {index === items.length - 1 ? (
            <span className="font-semibold text-slate-700">{item.label}</span>
          ) : (
            <Link to={item.path} className="transition hover:text-navy">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
