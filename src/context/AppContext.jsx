import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import db from "../data/db.json";
import { TODAY, addDays, diffDays } from "../lib/format";

const AppContext = createContext(null);

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value ?? fallback;
}

function makeInvoiceNumber(index) {
  return `INV-2026-${String(index + 1).padStart(3, "0")}`;
}

function buildInitialInvoices(seed) {
  return seed.bookings.map((booking, index) => {
    const vehicle = seed.vehicles.find((item) => item.id === booking.vehicleId) ?? null;
    const customer = seed.customers.find((item) => item.id === booking.customerId) ?? null;
    const driver = booking.driverId ? seed.drivers.find((item) => item.id === booking.driverId) ?? null : null;
    const issueDate = booking.startDate;
    const dueDate = addDays(booking.startDate, 7).toISOString().slice(0, 10);
    const subtotal = booking.subtotal;
    const driverFee = booking.type === "dengan-sopir" ? booking.totalDays * 250000 : 0;
    const fuelEstimate =
      booking.type === "dengan-sopir" ? booking.totalDays * 100000 : Math.round(booking.total * 0.06);
    const discount = booking.customerId === "CUST-003" ? Math.round((subtotal + driverFee + fuelEstimate) * 0.1) : 0;
    const depositPaid =
      booking.paymentStatus === "paid"
        ? booking.deposit
        : booking.paymentStatus === "dp"
          ? Math.round(booking.deposit * 0.4)
          : 0;
    const grossTotal = subtotal + driverFee + fuelEstimate - discount;
    const balanceDue = Math.max(grossTotal - depositPaid, 0);
    const age = diffDays(TODAY, dueDate);

    let status = "Terkirim";
    if (booking.paymentStatus === "paid") status = "Lunas";
    else if (booking.paymentStatus === "dp") status = "Sebagian Bayar";
    else if (age > 7) status = "Overdue";
    else if (index % 5 === 0) status = "Draft";

    return {
      id: `invoice-${booking.id}`,
      invoiceNo: makeInvoiceNumber(index),
      bookingId: booking.id,
      issueDate,
      dueDate,
      customerId: customer?.id ?? "",
      vehicleId: vehicle?.id ?? "",
      driverId: driver?.id ?? "",
      customer,
      vehicle,
      driver,
      startDate: booking.startDate,
      endDate: booking.endDate,
      durationDays: booking.totalDays,
      subtotal,
      driverFee,
      fuelEstimate,
      discount,
      depositPaid,
      grossTotal,
      balanceDue,
      total: grossTotal,
      status,
      createdAt: issueDate,
      notes: booking.notes ?? "",
      paymentHistory:
        depositPaid > 0
          ? [
              {
                id: `pay-${booking.id}-1`,
                date: booking.startDate,
                amount: depositPaid,
                method: booking.paymentStatus === "paid" ? "Transfer BCA" : "DP Transfer",
              },
            ]
          : [],
    };
  });
}

const initialState = {
  vehicles: db.vehicles,
  bookings: db.bookings,
  customers: db.customers,
  drivers: db.drivers,
  transactions: db.transactions,
  invoices: buildInitialInvoices(db),
  maintenance: db.maintenance,
  alerts: [],
};

function updateCollection(collection, id, updater) {
  return collection.map((item) => (item.id === id ? updater(item) : item));
}

function appReducer(state, action) {
  switch (action.type) {
    case "ADD":
      return {
        ...state,
        [action.entity]: [action.payload, ...state[action.entity]],
      };
    case "UPDATE":
      return {
        ...state,
        [action.entity]: updateCollection(state[action.entity], action.id, (item) => ({
          ...item,
          ...action.payload,
        })),
      };
    case "DELETE":
      return {
        ...state,
        [action.entity]: state[action.entity].filter((item) => item.id !== action.id),
      };
    case "UPDATE_STATUS":
      return {
        ...state,
        [action.entity]: updateCollection(state[action.entity], action.id, (item) => ({
          ...item,
          status: action.status,
        })),
      };
    case "SET_ALERTS":
      return {
        ...state,
        alerts: action.payload,
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [theme, setTheme] = useState(() => readStorage("choky-theme", "light"));
  const [session, setSession] = useState(() => readStorage("choky-session", "inactive") === "active");
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    window.localStorage.setItem("choky-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("choky-session", session ? "active" : "inactive");
  }, [session]);

  const pushToast = useCallback((toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, duration: 3000, ...toast }]);
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, toast.duration ?? 3000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const login = useCallback((username, password) => {
    const valid = username === "admin" && password === "choky2025";
    if (valid) {
      setSession(true);
    }
    return valid;
  }, []);

  const logout = useCallback(() => {
    setSession(false);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      theme,
      toggleTheme,
      isAuthenticated: session,
      login,
      logout,
      toasts,
      pushToast,
      dismissToast,
    }),
    [dismissToast, login, logout, pushToast, session, state, theme, toasts, toggleTheme],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider");
  }
  return context;
}
