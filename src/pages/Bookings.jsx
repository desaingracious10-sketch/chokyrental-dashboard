import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleEllipsis,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Grip,
  LayoutGrid,
  ListFilter,
  LoaderCircle,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Table2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  TODAY,
  addDays,
  dateInRange,
  diffDays,
  formatNumber,
  formatRupiah,
  startOfDay,
} from "../lib/format";
import { useAppContext } from "../context/AppContext";
import EmptyState from "../components/ui/EmptyState";

const PIPELINES = [
  { key: "inquiry", label: "Inquiry", emoji: "📥", tone: "bg-slate-100 text-slate-700" },
  { key: "confirmed", label: "Konfirmasi", emoji: "✅", tone: "bg-sky-100 text-sky-700" },
  { key: "dp_received", label: "DP Diterima", emoji: "💰", tone: "bg-amber-100 text-amber-700" },
  { key: "active", label: "Aktif", emoji: "🚗", tone: "bg-emerald-100 text-emerald-700" },
  { key: "completed", label: "Selesai", emoji: "✅", tone: "bg-indigo-100 text-indigo-700" },
  { key: "paid", label: "Lunas", emoji: "💯", tone: "bg-teal-100 text-teal-700" },
];

const VIEW_OPTIONS = [
  { key: "kanban", label: "Kanban Board", icon: LayoutGrid },
  { key: "timeline", label: "Timeline Gantt", icon: CalendarDays },
  { key: "table", label: "Table", icon: Table2 },
];

const RENTAL_TYPES = {
  "lepas-kunci": "Lepas Kunci",
  "dengan-sopir": "Dengan Sopir",
};

const PAYMENT_LABELS = {
  paid: "Lunas",
  dp: "DP",
  unpaid: "Belum",
};

const PAYMENT_TONES = {
  paid: "bg-emerald-100 text-emerald-700",
  dp: "bg-amber-100 text-amber-700",
  unpaid: "bg-rose-100 text-rose-700",
};

const STAGE_TONES = {
  inquiry: "bg-slate-100 border-slate-200",
  confirmed: "bg-sky-50 border-sky-200",
  dp_received: "bg-amber-50 border-amber-200",
  active: "bg-emerald-50 border-emerald-200",
  completed: "bg-indigo-50 border-indigo-200",
  paid: "bg-teal-50 border-teal-200",
};

const INITIAL_BOOKING_FORM = {
  selectedCustomerId: "",
  isNewCustomer: false,
  customerSearch: "",
  newCustomer: {
    name: "",
    phone: "",
    email: "",
    address: "",
  },
  startDateTime: "2026-04-28T09:00",
  endDateTime: "2026-04-30T09:00",
  rentalType: "lepas-kunci",
  pickupLocation: "Pool Bekasi",
  returnLocation: "Pool Bekasi",
  selectedVehicleId: "",
  selectedDriverId: "",
  notes: "",
  acceptedTerms: false,
};

function getPipelineStage(booking) {
  const start = startOfDay(booking.startDate);
  const today = startOfDay(TODAY);

  if (booking.status === "active") return "active";
  if (booking.status === "completed" && booking.paymentStatus === "paid") {
    return diffDays(today, booking.endDate) <= 7 ? "completed" : "paid";
  }
  if (booking.status === "upcoming" && booking.paymentStatus === "unpaid") return "inquiry";
  if (booking.status === "upcoming" && booking.paymentStatus === "dp") {
    return diffDays(start, today) > 10 ? "confirmed" : "dp_received";
  }
  if (booking.status === "upcoming" && booking.paymentStatus === "paid") return "confirmed";
  return "confirmed";
}

function normalizeBooking(booking) {
  return {
    ...booking,
    pipelineStage: getPipelineStage(booking),
    cancelled: false,
  };
}

function overlapDates(startA, endA, startB, endB) {
  const a1 = new Date(startA).getTime();
  const a2 = new Date(endA).getTime();
  const b1 = new Date(startB).getTime();
  const b2 = new Date(endB).getTime();
  return a1 < b2 && b1 < a2;
}

function bookingStatusFromStage(stage) {
  if (stage === "active") return "active";
  if (stage === "completed" || stage === "paid") return "completed";
  return "upcoming";
}

function paymentStatusFromStage(stage, currentPayment) {
  if (stage === "paid") return "paid";
  if (stage === "dp_received") return "dp";
  if (stage === "inquiry") return "unpaid";
  if (stage === "active" && currentPayment === "paid") return "paid";
  return currentPayment || "unpaid";
}

function formatDateShort(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}

function formatDateTimeLocal(dateTime) {
  const date = new Date(dateTime);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function generateMiniCalendar(baseDate) {
  const current = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const firstDayIndex = current.getDay();
  const start = addDays(current, -firstDayIndex);

  return Array.from({ length: 35 }, (_, index) => addDays(start, index));
}

function getDurationSummary(startDateTime, endDateTime) {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const hours = Math.max((end.getTime() - start.getTime()) / 36e5, 0);
  const days = Math.max(Math.ceil(hours / 24), 0);
  return { hours, days };
}

export default function Bookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    state: { bookings: bookingState, customers, drivers: rawDrivers, vehicles: rawVehicles },
    dispatch,
    pushToast,
  } = useAppContext();
  const bookings = useMemo(
    () => bookingState.map((booking) => ({ cancelled: false, ...normalizeBooking(booking), ...booking })),
    [bookingState],
  );
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const [selectedDriverId, setSelectedDriverId] = useState("all");
  const [selectedRentalType, setSelectedRentalType] = useState("all");
  const [viewMode, setViewMode] = useState("kanban");
  const [selectedBookingId, setSelectedBookingId] = useState(bookingState[0]?.id ?? null);
  const [draggingBookingId, setDraggingBookingId] = useState(null);
  const [tableSort, setTableSort] = useState({ key: "startDate", direction: "desc" });
  const [tablePage, setTablePage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingForm, setBookingForm] = useState(INITIAL_BOOKING_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);

  const vehiclesById = useMemo(
    () => Object.fromEntries(rawVehicles.map((vehicle) => [vehicle.id, vehicle])),
    [],
  );
  const driversById = useMemo(
    () => Object.fromEntries(rawDrivers.map((driver) => [driver.id, driver])),
    [],
  );
  const customersById = useMemo(
    () => Object.fromEntries(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const enrichedBookings = useMemo(() => {
    return bookings.map((booking) => {
      const customer = customersById[booking.customerId];
      const vehicle = vehiclesById[booking.vehicleId];
      const driver = booking.driverId ? driversById[booking.driverId] : null;
      return {
        ...booking,
        customer,
        vehicle,
        driver,
      };
    });
  }, [bookings, customersById, vehiclesById, driversById]);

  const filteredBookings = useMemo(() => {
    return enrichedBookings.filter((booking) => {
      const matchesDate = selectedDate
        ? dateInRange(selectedDate, booking.startDate, booking.endDate)
        : true;
      const matchesVehicle = selectedVehicleId === "all" ? true : booking.vehicleId === selectedVehicleId;
      const matchesDriver = selectedDriverId === "all" ? true : booking.driverId === selectedDriverId;
      const matchesType = selectedRentalType === "all" ? true : booking.type === selectedRentalType;
      return matchesDate && matchesVehicle && matchesDriver && matchesType;
    });
  }, [enrichedBookings, selectedDate, selectedVehicleId, selectedDriverId, selectedRentalType]);

  const pipelineCounts = useMemo(() => {
    return PIPELINES.reduce((acc, stage) => {
      acc[stage.key] = filteredBookings.filter(
        (booking) => booking.pipelineStage === stage.key && !booking.cancelled,
      ).length;
      return acc;
    }, {});
  }, [filteredBookings]);

  const bookingsByStage = useMemo(() => {
    return PIPELINES.reduce((acc, stage) => {
      acc[stage.key] = filteredBookings.filter(
        (booking) => booking.pipelineStage === stage.key && !booking.cancelled,
      );
      return acc;
    }, {});
  }, [filteredBookings]);

  const selectedBooking = useMemo(
    () => enrichedBookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [enrichedBookings, selectedBookingId],
  );

  const timelineDates = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(TODAY, index)), []);

  const timelineRows = useMemo(() => {
    return rawVehicles.map((vehicle) => {
      const relevantBookings = filteredBookings.filter(
        (booking) =>
          booking.vehicleId === vehicle.id &&
          !booking.cancelled &&
          overlapDates(booking.startDate, addDays(booking.endDate, 1), timelineDates[0], addDays(timelineDates[13], 1)),
      );

      return {
        vehicle,
        bookings: relevantBookings,
      };
    });
  }, [filteredBookings, timelineDates]);

  const tableRows = useMemo(() => {
    const sorted = [...filteredBookings].sort((a, b) => {
      const aValue = a[tableSort.key];
      const bValue = b[tableSort.key];
      let comparison = 0;

      if (tableSort.key === "customerId") {
        comparison = (a.customer?.name ?? "").localeCompare(b.customer?.name ?? "");
      } else if (tableSort.key === "vehicleId") {
        comparison = (a.vehicle?.name ?? "").localeCompare(b.vehicle?.name ?? "");
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return tableSort.direction === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredBookings, tableSort]);

  const totalTablePages = Math.max(1, Math.ceil(tableRows.length / 6));
  const paginatedRows = tableRows.slice((tablePage - 1) * 6, tablePage * 6);

  const calendarDays = useMemo(() => generateMiniCalendar(TODAY), []);

  const customerOptions = useMemo(() => {
    const q = bookingForm.customerSearch.toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers.filter((customer) => customer.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, bookingForm.customerSearch]);

  const selectedFormCustomer = bookingForm.selectedCustomerId
    ? customers.find((customer) => customer.id === bookingForm.selectedCustomerId)
    : null;

  const durationSummary = useMemo(
    () => getDurationSummary(bookingForm.startDateTime, bookingForm.endDateTime),
    [bookingForm.startDateTime, bookingForm.endDateTime],
  );

  const availableVehicles = useMemo(() => {
    return rawVehicles.filter((vehicle) => {
      return !bookings.some(
        (booking) =>
          booking.vehicleId === vehicle.id &&
          !booking.cancelled &&
          booking.status !== "completed" &&
          overlapDates(booking.startDate, addDays(booking.endDate, 1), bookingForm.startDateTime, bookingForm.endDateTime),
      );
    });
  }, [bookings, bookingForm.startDateTime, bookingForm.endDateTime]);

  const availableDrivers = useMemo(() => {
    return rawDrivers.filter((driver) => {
      if (driver.status === "off-duty") return false;
      return !bookings.some(
        (booking) =>
          booking.driverId === driver.id &&
          !booking.cancelled &&
          booking.status !== "completed" &&
          overlapDates(booking.startDate, addDays(booking.endDate, 1), bookingForm.startDateTime, bookingForm.endDateTime),
      );
    });
  }, [bookings, bookingForm.startDateTime, bookingForm.endDateTime]);

  const estimatedPrice = useMemo(() => {
    const vehicle = rawVehicles.find((item) => item.id === bookingForm.selectedVehicleId);
    if (!vehicle) return 0;
    const base = durationSummary.days * vehicle.dailyRate;
    const driverFee = bookingForm.rentalType === "dengan-sopir" ? durationSummary.days * 250000 : 0;
    return base + driverFee;
  }, [bookingForm.selectedVehicleId, bookingForm.rentalType, durationSummary.days]);

  useEffect(() => {
    const bookingId = searchParams.get("bookingId");
    const vehicleId = searchParams.get("vehicleId");

    if (bookingId) {
      setSelectedBookingId(bookingId);
    }
    if (vehicleId) {
      setSelectedVehicleId(vehicleId);
    }
    if (location.state?.openNewBooking) {
      setIsModalOpen(true);
      setBookingStep(1);
    }
    if (location.state?.customerId) {
      setIsModalOpen(true);
      setBookingStep(1);
      setBookingForm((current) => ({
        ...current,
        selectedCustomerId: location.state.customerId,
        isNewCustomer: false,
      }));
    }
  }, [location.state, searchParams]);

  useEffect(() => {
    function handleEscape() {
      setIsModalOpen(false);
      setActionMenuId(null);
    }

    function handleNewBooking() {
      setIsModalOpen(true);
      setBookingStep(1);
    }

    window.addEventListener("app:escape", handleEscape);
    window.addEventListener("app:booking:new", handleNewBooking);
    return () => {
      window.removeEventListener("app:escape", handleEscape);
      window.removeEventListener("app:booking:new", handleNewBooking);
    };
  }, []);

  function resetBookingModal() {
    setBookingStep(1);
    setBookingForm(INITIAL_BOOKING_FORM);
    setIsModalOpen(false);
  }

  function updateBookingRecord(bookingId, payload) {
    dispatch({ type: "UPDATE", entity: "bookings", id: bookingId, payload });
  }

  function updateBookingStage(bookingId, stage) {
    const currentBooking = bookings.find((booking) => booking.id === bookingId);
    if (!currentBooking) return;
    updateBookingRecord(bookingId, {
      pipelineStage: stage,
      status: bookingStatusFromStage(stage),
      paymentStatus: paymentStatusFromStage(stage, currentBooking.paymentStatus),
    });
  }

  function handleDrop(stage) {
    if (!draggingBookingId) return;
    updateBookingStage(draggingBookingId, stage);
    setDraggingBookingId(null);
  }

  function handleCancelBooking(bookingId) {
    updateBookingRecord(bookingId, { cancelled: true });
    setActionMenuId(null);
    pushToast({
      type: "info",
      title: "Booking dibatalkan",
      message: `${bookingId} berhasil dipindahkan dari pipeline aktif.`,
    });
  }

  function handleExtendBooking(bookingId) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    updateBookingRecord(bookingId, {
      endDate: addDays(booking.endDate, 1).toISOString().slice(0, 10),
      totalDays: Number(booking.totalDays) + 1,
      total: Number(booking.total) + (vehiclesById[booking.vehicleId]?.dailyRate ?? 0),
    });
    setActionMenuId(null);
    pushToast({
      type: "success",
      title: "Booking diperpanjang",
      message: `${bookingId} berhasil ditambah 1 hari.`,
    });
  }

  function handleDuplicateBooking(bookingId) {
    const source = bookings.find((booking) => booking.id === bookingId);
    if (!source) return;

    const cloneStart = addDays(source.startDate, 7);
    const cloneEnd = addDays(source.endDate, 7);
    const duplicate = {
      ...source,
      id: `BK-${String(bookings.length + 1).padStart(3, "0")}`,
      startDate: cloneStart.toISOString().slice(0, 10),
      endDate: cloneEnd.toISOString().slice(0, 10),
      status: "upcoming",
      paymentStatus: "unpaid",
      pipelineStage: "inquiry",
      cancelled: false,
      notes: `Duplicate dari ${source.id}`,
    };

    dispatch({ type: "ADD", entity: "bookings", payload: duplicate });
    setActionMenuId(null);
    pushToast({
      type: "success",
      title: "Booking berhasil diduplikasi",
      message: `Draft baru dibuat dari ${source.id}.`,
    });
  }

  function handleWhatsApp(booking) {
    const customerPhone = booking.customer?.phone?.replace(/^0/, "62") ?? "";
    const text = encodeURIComponent(
      `Halo ${booking.customer?.name}, booking ${booking.id} untuk ${booking.vehicle?.name} pada ${booking.startDate} - ${booking.endDate} siap diproses.`,
    );
    window.open(`https://wa.me/${customerPhone}?text=${text}`, "_blank", "noopener,noreferrer");
    pushToast({
      type: "info",
      title: "Konfirmasi dibuka di WhatsApp",
      message: `Siap dikirim ke ${booking.customer?.name ?? "customer"}.`,
    });
  }

  function handlePrintBooking(booking) {
    const popup = window.open("", "_blank", "width=800,height=600");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head><title>Booking ${booking.id}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 32px;">
          <h1>Booking Confirmation ${booking.id}</h1>
          <p><strong>Customer:</strong> ${booking.customer?.name ?? "-"}</p>
          <p><strong>Kendaraan:</strong> ${booking.vehicle?.name ?? "-"}</p>
          <p><strong>Periode:</strong> ${booking.startDate} s/d ${booking.endDate}</p>
          <p><strong>Total:</strong> ${formatRupiah(booking.total)}</p>
          <p><strong>Status pembayaran:</strong> ${PAYMENT_LABELS[booking.paymentStatus]}</p>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function openBookingModal() {
    setBookingStep(1);
    setIsModalOpen(true);
  }

  async function createBookingAndInvoice() {
    if (!bookingForm.acceptedTerms) return;
    setIsSaving(true);

    let customerId = bookingForm.selectedCustomerId;
    if (bookingForm.isNewCustomer) {
      const newCustomerId = `CUST-${String(customers.length + 1).padStart(3, "0")}`;
      const newCustomer = {
        id: newCustomerId,
        name: bookingForm.newCustomer.name,
        phone: bookingForm.newCustomer.phone,
        email: bookingForm.newCustomer.email,
        address: bookingForm.newCustomer.address,
        joinedAt: TODAY.toISOString().slice(0, 10),
        totalBookings: 1,
        totalSpent: estimatedPrice,
        status: "new",
      };
      dispatch({ type: "ADD", entity: "customers", payload: newCustomer });
      customerId = newCustomerId;
    } else if (customerId) {
      const existingCustomer = customers.find((customer) => customer.id === customerId);
      if (existingCustomer) {
        dispatch({
          type: "UPDATE",
          entity: "customers",
          id: customerId,
          payload: {
            totalBookings: Number(existingCustomer.totalBookings || 0) + 1,
            totalSpent: Number(existingCustomer.totalSpent || 0) + estimatedPrice,
          },
        });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const newBooking = {
      id: `BK-${String(bookings.length + 1).padStart(3, "0")}`,
      customerId,
      vehicleId: bookingForm.selectedVehicleId,
      driverId: bookingForm.rentalType === "dengan-sopir" ? bookingForm.selectedDriverId : null,
      type: bookingForm.rentalType,
      startDate: bookingForm.startDateTime.slice(0, 10),
      endDate: bookingForm.endDateTime.slice(0, 10),
      pickupLocation: bookingForm.pickupLocation,
      dropoffLocation: bookingForm.returnLocation,
      totalDays: durationSummary.days,
      subtotal: estimatedPrice,
      deposit: Math.round(estimatedPrice * 0.4),
      total: estimatedPrice,
      paymentStatus: "unpaid",
      status: "upcoming",
      notes: bookingForm.notes,
      pipelineStage: "inquiry",
      cancelled: false,
    };

    dispatch({ type: "ADD", entity: "bookings", payload: newBooking });
    setSelectedBookingId(newBooking.id);
    setIsSaving(false);
    resetBookingModal();
    pushToast({
      type: "success",
      title: "Booking berhasil disimpan!",
      message: `${newBooking.id} siap dibuatkan invoice.`,
    });
    navigate("/invoice", { state: { openNewInvoice: true, bookingId: newBooking.id } });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <ClipboardCheck className="h-4 w-4" />
              Booking control center
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Booking Management</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Pantau inquiry sampai lunas, geser status via kanban, dan buat booking baru dengan alur step-by-step.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openBookingModal}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-navy transition hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              Tambah Booking
            </button>
            <button
              type="button"
              onClick={() => navigate("/invoice", { state: { openNewInvoice: true } })}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Download className="h-4 w-4" />
              Invoice
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kalender Bulan Ini</h3>
                <p className="text-sm text-slate-500">Klik tanggal untuk filter booking.</p>
              </div>
              {selectedDate ? (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="text-sm font-semibold text-teal"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const isCurrentMonth = day.getMonth() === TODAY.getMonth();
                const isSelected =
                  selectedDate && startOfDay(selectedDate).getTime() === startOfDay(day).getTime();
                const count = enrichedBookings.filter((booking) => dateInRange(day, booking.startDate, booking.endDate)).length;

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={`rounded-2xl border p-2 text-sm transition ${
                      isSelected
                        ? "border-teal bg-teal text-white"
                        : isCurrentMonth
                          ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          : "border-transparent bg-slate-50/50 text-slate-300"
                    }`}
                  >
                    <div>{day.getDate()}</div>
                    <div className={`mt-1 text-[10px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>{count}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Pipeline Count</h3>
            <div className="mt-4 space-y-3">
              {PIPELINES.map((stage) => (
                <div key={stage.key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{stage.emoji}</span>
                    <span className="font-medium text-slate-700">{stage.label}</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{formatNumber(pipelineCounts[stage.key] ?? 0)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-slate-500" />
              <h3 className="text-lg font-bold text-slate-900">Filter</h3>
            </div>

            <div className="mt-4 space-y-4">
              <FilterSelect
                label="Kendaraan"
                value={selectedVehicleId}
                onChange={setSelectedVehicleId}
                options={[
                  { value: "all", label: "Semua kendaraan" },
                  ...rawVehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.name })),
                ]}
              />
              <FilterSelect
                label="Sopir"
                value={selectedDriverId}
                onChange={setSelectedDriverId}
                options={[
                  { value: "all", label: "Semua sopir" },
                  ...rawDrivers.map((driver) => ({ value: driver.id, label: driver.name })),
                ]}
              />
              <FilterSelect
                label="Jenis sewa"
                value={selectedRentalType}
                onChange={setSelectedRentalType}
                options={[
                  { value: "all", label: "Semua jenis" },
                  ...Object.entries(RENTAL_TYPES).map(([value, label]) => ({ value, label })),
                ]}
              />
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Booking List & Workflow</h3>
                <p className="text-sm text-slate-500">Switch antara kanban, timeline, dan table sesuai kebutuhan operasional.</p>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {VIEW_OPTIONS.map((view) => {
                  const Icon = view.icon;
                  const active = viewMode === view.key;
                  return (
                    <button
                      key={view.key}
                      type="button"
                      onClick={() => setViewMode(view.key)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active ? "bg-white text-navy shadow-sm" : "text-slate-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {view.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon="📅"
                  title="Belum ada booking"
                  message="Belum ada booking yang cocok dengan filter saat ini. Buat booking pertama untuk mulai mengisi pipeline."
                  actionLabel="Buat Booking Pertama"
                  onAction={openBookingModal}
                />
              </div>
            ) : null}

            {viewMode === "kanban" && filteredBookings.length > 0 ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
                {PIPELINES.map((stage) => (
                  <div
                    key={stage.key}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(stage.key)}
                    className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stage.tone}`}>
                          {stage.emoji} {stage.label}
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                        {bookingsByStage[stage.key]?.length ?? 0}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {bookingsByStage[stage.key]?.map((booking) => (
                        <KanbanCard
                          key={booking.id}
                          booking={booking}
                          active={selectedBookingId === booking.id}
                          menuOpen={actionMenuId === booking.id}
                          onClick={() => setSelectedBookingId(booking.id)}
                          onDragStart={() => setDraggingBookingId(booking.id)}
                          onToggleMenu={() => setActionMenuId(actionMenuId === booking.id ? null : booking.id)}
                          onCancel={() => handleCancelBooking(booking.id)}
                          onExtend={() => handleExtendBooking(booking.id)}
                          onDuplicate={() => handleDuplicateBooking(booking.id)}
                          onWhatsApp={() => handleWhatsApp(booking)}
                          onPrint={() => handlePrintBooking(booking)}
                          onStageChange={(stageKey) => updateBookingStage(booking.id, stageKey)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {viewMode === "timeline" && filteredBookings.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
                <div className="min-w-[1100px]">
                  <div className="grid grid-cols-[250px_repeat(14,minmax(0,1fr))] gap-2">
                    <div className="px-4 py-3 text-sm font-semibold text-slate-500">Kendaraan</div>
                    {timelineDates.map((date) => (
                      <div
                        key={date.toISOString()}
                        className="rounded-2xl bg-slate-100 px-2 py-3 text-center text-xs font-semibold text-slate-700"
                      >
                        <div>{formatDateShort(date)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2">
                    {timelineRows.map((row) => (
                      <TimelineRow key={row.vehicle.id} row={row} dates={timelineDates} onSelect={setSelectedBookingId} />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {viewMode === "table" && filteredBookings.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        ["No", null],
                        ["Customer", "customerId"],
                        ["Kendaraan", "vehicleId"],
                        ["Mulai", "startDate"],
                        ["Selesai", "endDate"],
                        ["Durasi", "totalDays"],
                        ["Total", "total"],
                        ["Status", "pipelineStage"],
                        ["Aksi", null],
                      ].map(([label, sortKey]) => (
                        <th key={label} className="px-4 py-3 font-semibold">
                          {sortKey ? (
                            <button
                              type="button"
                              onClick={() =>
                                setTableSort((current) => ({
                                  key: sortKey,
                                  direction:
                                    current.key === sortKey && current.direction === "asc" ? "desc" : "asc",
                                }))
                              }
                              className="inline-flex items-center gap-2"
                            >
                              {label}
                              <ArrowRight className="h-3 w-3 rotate-90 text-slate-400" />
                            </button>
                          ) : (
                            label
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((booking, index) => (
                      <tr key={booking.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{(tablePage - 1) * 6 + index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{booking.customer?.name}</td>
                        <td className="px-4 py-3 text-slate-700">{booking.vehicle?.name}</td>
                        <td className="px-4 py-3">{booking.startDate}</td>
                        <td className="px-4 py-3">{booking.endDate}</td>
                        <td className="px-4 py-3">{booking.totalDays} hari</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(booking.total)}</td>
                        <td className="px-4 py-3">
                          <StageBadge stage={booking.pipelineStage} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <SmallAction onClick={() => setSelectedBookingId(booking.id)} icon={Search} label="Detail" />
                            <SmallAction onClick={() => handlePrintBooking(booking)} icon={Printer} label="Print" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Menampilkan {(tablePage - 1) * 6 + 1} - {Math.min(tablePage * 6, tableRows.length)} dari {tableRows.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTablePage((current) => Math.max(1, current - 1))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setTablePage((current) => Math.min(totalTablePages, current + 1))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {selectedBooking ? (
            <BookingDetailPanel
              booking={selectedBooking}
              onCreateInvoice={() => navigate("/invoice", { state: { openNewInvoice: true, bookingId: selectedBooking.id } })}
              onWhatsApp={() => handleWhatsApp(selectedBooking)}
              onPrint={() => handlePrintBooking(selectedBooking)}
              onCancel={() => handleCancelBooking(selectedBooking.id)}
              onExtend={() => handleExtendBooking(selectedBooking.id)}
              onDuplicate={() => handleDuplicateBooking(selectedBooking.id)}
            />
          ) : null}
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45">
          <div className="min-h-screen bg-slate-100">
            <div className="animate-modal-in sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5 shadow-sm">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Tambah Booking Baru</h3>
                  <p className="mt-1 text-sm text-slate-500">Ikuti 5 langkah untuk membuat booking dan generate invoice.</p>
                </div>
                <button
                  type="button"
                  onClick={resetBookingModal}
                  className="rounded-2xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((step) => {
                    const label =
                      step === 1
                        ? "Pilih Customer"
                        : step === 2
                          ? "Detail Sewa"
                          : step === 3
                            ? "Pilih Kendaraan"
                            : step === 4
                              ? "Pilih Sopir"
                              : "Review & Konfirmasi";

                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setBookingStep(step)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                          bookingStep === step ? "bg-navy text-white" : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            bookingStep === step ? "bg-white/15 text-white" : "bg-white text-slate-700"
                          }`}
                        >
                          {step}
                        </span>
                        <span className="font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="space-y-6">
                {bookingStep === 1 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-bold text-slate-900">Step 1 — Pilih Customer</h4>
                        <p className="text-sm text-slate-500">Cari customer existing atau tambahkan customer baru.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBookingForm((current) => ({
                            ...current,
                            isNewCustomer: !current.isNewCustomer,
                            selectedCustomerId: "",
                          }))
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        <UserPlus className="h-4 w-4" />
                        {bookingForm.isNewCustomer ? "Pilih Existing" : "+ Customer Baru"}
                      </button>
                    </div>

                    {!bookingForm.isNewCustomer ? (
                      <div className="mt-5">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={bookingForm.customerSearch}
                            onChange={(event) =>
                              setBookingForm((current) => ({ ...current, customerSearch: event.target.value }))
                            }
                            placeholder="Cari customer..."
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-teal"
                          />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {customerOptions.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() =>
                                setBookingForm((current) => ({ ...current, selectedCustomerId: customer.id }))
                              }
                              className={`rounded-2xl border p-4 text-left transition ${
                                bookingForm.selectedCustomerId === customer.id
                                  ? "border-teal bg-teal/5"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                                  {customer.name
                                    .split(" ")
                                    .slice(0, 2)
                                    .map((part) => part[0])
                                    .join("")}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{customer.name}</p>
                                  <p className="text-sm text-slate-500">{customer.phone}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {selectedFormCustomer ? (
                          <div className="mt-5 rounded-3xl bg-slate-50 p-5">
                            <h5 className="font-semibold text-slate-900">Riwayat Customer</h5>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <InfoPill label="Total Booking" value={`${selectedFormCustomer.totalBookings} booking`} />
                              <InfoPill label="Total Spent" value={formatRupiah(selectedFormCustomer.totalSpent)} />
                              <InfoPill label="Status" value={selectedFormCustomer.status} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <TextField
                          label="Nama"
                          value={bookingForm.newCustomer.name}
                          onChange={(value) =>
                            setBookingForm((current) => ({
                              ...current,
                              newCustomer: { ...current.newCustomer, name: value },
                            }))
                          }
                        />
                        <TextField
                          label="Phone"
                          value={bookingForm.newCustomer.phone}
                          onChange={(value) =>
                            setBookingForm((current) => ({
                              ...current,
                              newCustomer: { ...current.newCustomer, phone: value },
                            }))
                          }
                        />
                        <TextField
                          label="Email"
                          value={bookingForm.newCustomer.email}
                          onChange={(value) =>
                            setBookingForm((current) => ({
                              ...current,
                              newCustomer: { ...current.newCustomer, email: value },
                            }))
                          }
                        />
                        <TextField
                          label="Alamat"
                          value={bookingForm.newCustomer.address}
                          onChange={(value) =>
                            setBookingForm((current) => ({
                              ...current,
                              newCustomer: { ...current.newCustomer, address: value },
                            }))
                          }
                        />
                      </div>
                    )}
                  </section>
                ) : null}

                {bookingStep === 2 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-xl font-bold text-slate-900">Step 2 — Detail Sewa</h4>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <TextField
                        label="Tanggal & Jam Mulai"
                        type="datetime-local"
                        value={bookingForm.startDateTime}
                        onChange={(value) => setBookingForm((current) => ({ ...current, startDateTime: value }))}
                      />
                      <TextField
                        label="Tanggal & Jam Selesai"
                        type="datetime-local"
                        value={bookingForm.endDateTime}
                        onChange={(value) => setBookingForm((current) => ({ ...current, endDateTime: value }))}
                      />
                      <SelectField
                        label="Jenis Sewa"
                        value={bookingForm.rentalType}
                        onChange={(value) => setBookingForm((current) => ({ ...current, rentalType: value }))}
                        options={Object.entries(RENTAL_TYPES).map(([value, label]) => ({ value, label }))}
                      />
                      <TextField
                        label="Pickup Location"
                        value={bookingForm.pickupLocation}
                        onChange={(value) => setBookingForm((current) => ({ ...current, pickupLocation: value }))}
                      />
                      <TextField
                        label="Return Location"
                        value={bookingForm.returnLocation}
                        onChange={(value) => setBookingForm((current) => ({ ...current, returnLocation: value }))}
                      />
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <InfoPill label="Durasi" value={`${durationSummary.days} hari`} />
                      <InfoPill label="Estimasi jam" value={`${Math.round(durationSummary.hours)} jam`} />
                      <InfoPill label="Estimasi harga" value={formatRupiah(estimatedPrice)} />
                    </div>
                  </section>
                ) : null}

                {bookingStep === 3 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-xl font-bold text-slate-900">Step 3 — Pilih Kendaraan</h4>
                    <p className="mt-1 text-sm text-slate-500">Hanya unit yang tersedia pada periode terpilih yang ditampilkan.</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {availableVehicles.map((vehicle) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() =>
                            setBookingForm((current) => ({ ...current, selectedVehicleId: vehicle.id }))
                          }
                          className={`rounded-3xl border p-5 text-left transition ${
                            bookingForm.selectedVehicleId === vehicle.id
                              ? "border-teal bg-teal/5"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-4xl">{vehicle.type.includes("Hiace") ? "🚐" : "🚘"}</div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Tersedia
                            </span>
                          </div>
                          <h5 className="mt-4 font-bold text-slate-900">{vehicle.name}</h5>
                          <p className="mt-1 text-sm text-slate-500">{vehicle.plate}</p>
                          <p className="mt-3 text-sm font-semibold text-slate-900">{formatRupiah(vehicle.dailyRate)}/hari</p>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {bookingStep === 4 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-xl font-bold text-slate-900">Step 4 — Pilih Sopir</h4>
                    {bookingForm.rentalType !== "dengan-sopir" ? (
                      <div className="mt-5 rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">
                        Booking ini menggunakan mode lepas kunci, jadi pemilihan sopir tidak diperlukan.
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {availableDrivers.map((driver) => (
                          <button
                            key={driver.id}
                            type="button"
                            onClick={() =>
                              setBookingForm((current) => ({ ...current, selectedDriverId: driver.id }))
                            }
                            className={`rounded-3xl border p-5 text-left transition ${
                              bookingForm.selectedDriverId === driver.id
                                ? "border-teal bg-teal/5"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                                {driver.name
                                  .split(" ")
                                  .slice(1, 3)
                                  .map((part) => part[0])
                                  .join("")}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{driver.name}</p>
                                <p className="text-sm text-slate-500">{driver.license}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                              <InfoPill label="Rating" value={`${driver.rating}/5`} />
                              <InfoPill label="Status" value={driver.status} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}

                {bookingStep === 5 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-xl font-bold text-slate-900">Step 5 — Review & Konfirmasi</h4>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <InfoPill
                        label="Customer"
                        value={selectedFormCustomer?.name ?? bookingForm.newCustomer.name ?? "-"}
                      />
                      <InfoPill
                        label="Kendaraan"
                        value={rawVehicles.find((vehicle) => vehicle.id === bookingForm.selectedVehicleId)?.name ?? "-"}
                      />
                      <InfoPill label="Periode" value={`${formatDateTimeLocal(bookingForm.startDateTime)} - ${formatDateTimeLocal(bookingForm.endDateTime)}`} />
                      <InfoPill label="Jenis Sewa" value={RENTAL_TYPES[bookingForm.rentalType]} />
                      <InfoPill
                        label="Sopir"
                        value={
                          bookingForm.rentalType === "dengan-sopir"
                            ? rawDrivers.find((driver) => driver.id === bookingForm.selectedDriverId)?.name ?? "-"
                            : "Tidak diperlukan"
                        }
                      />
                      <InfoPill label="Estimasi Harga" value={formatRupiah(estimatedPrice)} />
                    </div>

                    <div className="mt-5">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Catatan Tambahan</label>
                      <textarea
                        value={bookingForm.notes}
                        onChange={(event) =>
                          setBookingForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal"
                      />
                    </div>

                    <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={bookingForm.acceptedTerms}
                        onChange={(event) =>
                          setBookingForm((current) => ({ ...current, acceptedTerms: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Saya sudah memeriksa data booking, syarat dan ketentuan, serta siap membuat booking dan generate invoice.</span>
                    </label>
                  </section>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingStep((current) => Math.max(1, current - 1))}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Sebelumnya
                  </button>

                  {bookingStep < 5 ? (
                    <button
                      type="button"
                      onClick={() => setBookingStep((current) => Math.min(5, current + 1))}
                      className="inline-flex items-center gap-2 rounded-2xl bg-navy px-5 py-3 text-sm font-semibold text-white"
                    >
                      Selanjutnya
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!bookingForm.acceptedTerms || isSaving}
                      onClick={createBookingAndInvoice}
                      className="inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Buat Booking & Generate Invoice
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KanbanCard({
  booking,
  active,
  menuOpen,
  onClick,
  onDragStart,
  onToggleMenu,
  onCancel,
  onExtend,
  onDuplicate,
  onWhatsApp,
  onPrint,
  onStageChange,
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      className={`rounded-3xl border bg-white p-4 shadow-sm transition ${active ? "border-teal ring-2 ring-teal/20" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
              {booking.customer?.name
                ?.split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{booking.customer?.name}</p>
              <p className="truncate text-sm text-slate-500">{booking.vehicle?.name}</p>
            </div>
          </div>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500"
          >
            <CircleEllipsis className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <QuickItem label="Batalkan" onClick={onCancel} />
              <QuickItem label="Perpanjang 1 hari" onClick={onExtend} />
              <QuickItem label="Duplicate booking" onClick={onDuplicate} />
              <QuickItem label="Kirim WhatsApp" onClick={onWhatsApp} />
              <QuickItem label="Print / PDF" onClick={onPrint} />
              <div className="my-2 border-t border-slate-200" />
              {PIPELINES.map((stage) => (
                <QuickItem
                  key={stage.key}
                  label={`Pindah ke ${stage.label}`}
                  onClick={() => onStageChange(stage.key)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <p>
          {formatDateShort(booking.startDate)} - {formatDateShort(booking.endDate)}
        </p>
        <p className="font-semibold text-slate-900">{formatRupiah(booking.total)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PAYMENT_TONES[booking.paymentStatus]}`}>
          {PAYMENT_LABELS[booking.paymentStatus]}
        </span>
        <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
          <Grip className="h-3 w-3" />
          drag
        </div>
      </div>
    </article>
  );
}

function QuickItem({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
    >
      {label}
      <ArrowRight className="h-3 w-3 text-slate-400" />
    </button>
  );
}

function TimelineRow({ row, dates, onSelect }) {
  return (
    <div className="grid grid-cols-[250px_1fr] gap-2">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <p className="font-semibold text-slate-900">{row.vehicle.name}</p>
        <p className="mt-1 text-sm text-slate-500">{row.vehicle.plate}</p>
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-white px-3 py-4">
        <div className="grid grid-cols-14 gap-1">
          {dates.map((date) => (
            <div key={date.toISOString()} className="h-14 rounded-xl bg-slate-50" />
          ))}
        </div>

        {row.bookings.map((booking) => {
          const startIndex = Math.max(0, diffDays(booking.startDate, dates[0]));
          const endIndex = Math.min(13, diffDays(booking.endDate, dates[0]));
          const span = Math.max(1, endIndex - startIndex + 1);

          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => onSelect(booking.id)}
              title={`${booking.customer?.name} • ${booking.vehicle?.name} • ${booking.startDate} - ${booking.endDate}`}
              className={`absolute top-4 z-10 h-14 rounded-2xl border px-3 text-left text-sm font-semibold text-slate-700 shadow-sm ${STAGE_TONES[booking.pipelineStage]}`}
              style={{
                left: `calc(${startIndex} * (100% / 14) + 12px)`,
                width: `calc(${span} * (100% / 14) - 8px)`,
              }}
            >
              <span className="truncate">{booking.customer?.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookingDetailPanel({ booking, onCreateInvoice, onWhatsApp, onPrint, onCancel, onExtend, onDuplicate }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-slate-900">Detail Booking {booking.id}</h3>
            <StageBadge stage={booking.pipelineStage} />
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PAYMENT_TONES[booking.paymentStatus]}`}>
              {PAYMENT_LABELS[booking.paymentStatus]}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {booking.customer?.name} • {booking.vehicle?.name} • {RENTAL_TYPES[booking.type]}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <QuickActionButton onClick={onCreateInvoice} icon={Download} label="Buat Invoice" />
          <QuickActionButton onClick={onWhatsApp} icon={MessageCircle} label="WhatsApp" />
          <QuickActionButton onClick={onPrint} icon={Printer} label="Print/PDF" />
          <QuickActionButton onClick={onExtend} icon={Clock3} label="Perpanjang" />
          <QuickActionButton onClick={onDuplicate} icon={Copy} label="Duplicate" />
          <QuickActionButton onClick={onCancel} icon={X} label="Batalkan" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoPill label="Customer" value={booking.customer?.name ?? "-"} />
        <InfoPill label="Kendaraan" value={booking.vehicle?.name ?? "-"} />
        <InfoPill label="Periode" value={`${booking.startDate} - ${booking.endDate}`} />
        <InfoPill label="Total" value={formatRupiah(booking.total)} />
        <InfoPill label="Pickup" value={booking.pickupLocation} />
        <InfoPill label="Return" value={booking.dropoffLocation} />
        <InfoPill label="Sopir" value={booking.driver?.name ?? "Tidak ada"} />
        <InfoPill label="Catatan" value={booking.notes || "-"} />
      </div>
    </section>
  );
}

function StageBadge({ stage }) {
  const meta = PIPELINES.find((item) => item.key === stage);
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta?.tone ?? "bg-slate-100 text-slate-700"}`}>
      {meta?.label ?? stage}
    </span>
  );
}

function SmallAction({ onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function QuickActionButton({ onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
