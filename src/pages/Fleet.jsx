import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Car,
  ChevronDown,
  Clock3,
  Eye,
  FileBadge2,
  Gauge,
  Grid2X2,
  List,
  LoaderCircle,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TODAY, diffDays, formatNumber, formatRupiah, isSameMonth, startOfDay } from "../lib/format";
import { useAppContext } from "../context/AppContext";
import EmptyState from "../components/ui/EmptyState";

const VEHICLE_EMOJI = {
  "Hiace Premio": "🚐",
  Innova: "🚘",
  Rush: "🚙",
  Jazz: "🚗",
  Elf: "🚌",
  default: "🚘",
};

const TYPE_OPTIONS = ["Minibus", "MPV", "SUV", "Hatchback", "Microbus"];
const STATUS_OPTIONS = ["all", "available", "rented", "maintenance", "inactive"];
const VIEW_OPTIONS = [
  { key: "grid", label: "Grid view", icon: Grid2X2 },
  { key: "list", label: "List view", icon: List },
  { key: "table", label: "Table view", icon: Table2 },
];

const DETAIL_TABS = [
  { key: "info", label: "Info Umum" },
  { key: "bookings", label: "Riwayat Booking" },
  { key: "maintenance", label: "Maintenance" },
  { key: "analytics", label: "Analytics" },
];

const STATUS_META = {
  available: {
    label: "Tersedia",
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    cell: "bg-emerald-50 border-emerald-200",
  },
  rented: {
    label: "Disewa",
    badge: "bg-rose-100 text-rose-700 ring-rose-200",
    cell: "bg-rose-50 border-rose-200",
  },
  maintenance: {
    label: "Servis",
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
    cell: "bg-amber-50 border-amber-200",
  },
  inactive: {
    label: "Tidak Aktif",
    badge: "bg-slate-200 text-slate-700 ring-slate-300",
    cell: "bg-slate-50 border-slate-200",
  },
};

const EMPTY_FORM = {
  id: null,
  name: "",
  brand: "",
  model: "",
  year: "",
  plate: "",
  chassisNumber: "",
  engineNumber: "",
  color: "",
  seats: "",
  category: TYPE_OPTIONS[0],
  dailyRate: "",
  hourlyRate: "",
  transmission: "Automatic",
  fuel: "Bensin",
  stnkExpiry: "",
  kirExpiry: "",
  insuranceExpiry: "",
  status: "available",
  location: "",
  imageEmoji: "🚘",
};

function createDocDate(baseDate, offsetDays) {
  const value = new Date(baseDate);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function inferBrandModel(name) {
  const parts = name.split(" ");
  return {
    brand: parts[0] ?? "",
    model: parts.slice(1).join(" ") || name,
  };
}

function normalizeVehicle(vehicle, index) {
  const inferred = inferBrandModel(vehicle.name);
  const anchor = startOfDay(TODAY);
  const stnkExpiry = vehicle.stnkExpiry ?? createDocDate(anchor, 10 + index * 17);
  const kirExpiry = vehicle.kirExpiry ?? createDocDate(anchor, 25 + index * 14);
  const insuranceExpiry = vehicle.insuranceExpiry ?? createDocDate(anchor, 45 + index * 11);

  return {
    ...vehicle,
    brand: vehicle.brand ?? inferred.brand,
    model: vehicle.model ?? inferred.model,
    hourlyRate: vehicle.hourlyRate ?? Math.round(vehicle.dailyRate / 8),
    stnkExpiry,
    kirExpiry,
    insuranceExpiry,
    chassisNumber: vehicle.chassisNumber ?? `MH${vehicle.id.replace("VH-", "")}${vehicle.year}${index + 11}CHK`,
    engineNumber: vehicle.engineNumber ?? `ENG${vehicle.id.replace("VH-", "")}${String(vehicle.odometer).slice(0, 5)}`,
    imageEmoji: vehicle.imageEmoji ?? VEHICLE_EMOJI[vehicle.type] ?? VEHICLE_EMOJI.default,
    status:
      vehicle.status === "inactive"
        ? "inactive"
        : vehicle.status === "available"
          ? "available"
          : vehicle.status === "rented"
            ? "rented"
            : "maintenance",
  };
}

function fleetReducer(state, action) {
  switch (action.type) {
    case "save_start":
      return { ...state, saving: true };
    case "save_vehicle": {
      const exists = state.vehicles.some((vehicle) => vehicle.id === action.payload.id);
      const vehicles = exists
        ? state.vehicles.map((vehicle) => (vehicle.id === action.payload.id ? action.payload : vehicle))
        : [action.payload, ...state.vehicles];
      return { ...state, vehicles, saving: false };
    }
    case "update_status":
      return {
        ...state,
        vehicles: state.vehicles.map((vehicle) =>
          vehicle.id === action.id ? { ...vehicle, status: action.status } : vehicle,
        ),
      };
    case "delete_vehicle":
      return {
        ...state,
        vehicles: state.vehicles.filter((vehicle) => vehicle.id !== action.id),
      };
    default:
      return state;
  }
}

function formatMonthKey(date) {
  const value = startOfDay(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", {
    month: "short",
    year: "2-digit",
  });
}

function getDocumentMeta(expiryDate) {
  const remaining = diffDays(expiryDate, TODAY);

  if (remaining < 0) {
    return {
      label: "Expired",
      tone: "bg-rose-100 text-rose-700 ring-rose-200",
    };
  }

  if (remaining < 30) {
    return {
      label: `${remaining} hari lagi`,
      tone: "bg-amber-100 text-amber-700 ring-amber-200",
    };
  }

  return {
    label: `${remaining} hari lagi`,
    tone: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  };
}

function simulateSave(callback) {
  return new Promise((resolve) => {
    setTimeout(() => {
      callback();
      resolve();
    }, 500);
  });
}

export default function Fleet() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    state: { vehicles: rawVehicles, bookings, maintenance, customers },
    dispatch,
    pushToast,
  } = useAppContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [detailTab, setDetailTab] = useState("info");
  const [bookingMonthFilter, setBookingMonthFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [actionMenuId, setActionMenuId] = useState(null);
  const [saving, setSaving] = useState(false);
  const vehicles = useMemo(() => rawVehicles.map(normalizeVehicle), [rawVehicles]);

  const analytics = useMemo(() => {
    const vehicleBookingMap = bookings.reduce((acc, booking) => {
      if (!acc[booking.vehicleId]) acc[booking.vehicleId] = [];
      acc[booking.vehicleId].push(booking);
      return acc;
    }, {});

    const vehicleMaintenanceMap = maintenance.reduce((acc, item) => {
      if (!acc[item.vehicleId]) acc[item.vehicleId] = [];
      acc[item.vehicleId].push(item);
      return acc;
    }, {});

    return vehicles.map((vehicle) => {
      const vehicleBookings = (vehicleBookingMap[vehicle.id] ?? []).slice().sort((a, b) => {
        return new Date(b.startDate) - new Date(a.startDate);
      });
      const vehicleMaintenance = (vehicleMaintenanceMap[vehicle.id] ?? []).slice().sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      const monthBookings = vehicleBookings.filter((booking) =>
        isSameMonth(startOfDay(booking.startDate), TODAY),
      );
      const monthRevenue = monthBookings.reduce((sum, booking) => sum + booking.total, 0);
      const rentedDays = monthBookings.reduce((sum, booking) => sum + Number(booking.totalDays || 0), 0);
      const daysInMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
      const utilizationRate = Math.min(100, Math.round((rentedDays / Math.max(daysInMonth, 1)) * 100));
      const totalMaintenanceCost = vehicleMaintenance.reduce((sum, item) => sum + item.cost, 0);
      const customerCount = new Set(vehicleBookings.map((booking) => booking.customerId)).size;

      const monthlyChart = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(TODAY.getFullYear(), TODAY.getMonth() - 5 + index, 1);
        const monthlyBookings = vehicleBookings.filter((booking) =>
          isSameMonth(startOfDay(booking.startDate), date),
        );
        const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const utilizedDays = monthlyBookings.reduce((sum, booking) => sum + Number(booking.totalDays || 0), 0);
        const revenue = monthlyBookings.reduce((sum, booking) => sum + booking.total, 0);
        const maintenanceCost = vehicleMaintenance
          .filter((item) => isSameMonth(startOfDay(item.date), date))
          .reduce((sum, item) => sum + item.cost, 0);

        return {
          monthKey: formatMonthKey(date),
          monthLabel: monthLabel(formatMonthKey(date)),
          utilization: Math.min(100, Math.round((utilizedDays / Math.max(monthDays, 1)) * 100)),
          revenue,
          maintenanceCost,
        };
      });

      const profitabilityScore = Math.max(
        20,
        Math.min(
          98,
          Math.round(((monthRevenue - totalMaintenanceCost * 0.15) / Math.max(vehicle.dailyRate * 10, 1)) * 100),
        ),
      );

      const recommendation =
        profitabilityScore >= 80
          ? "Armada sangat sehat. Pertahankan pricing premium dan prioritaskan unit ini untuk booking high-value."
          : profitabilityScore >= 55
            ? "Performa cukup stabil. Dorong upsell sopir atau paket perjalanan untuk menaikkan margin."
            : "Profitabilitas mulai tertekan. Evaluasi tarif, frekuensi servis, dan jadwal penggunaan agar lebih efisien.";

      return {
        ...vehicle,
        bookings: vehicleBookings,
        maintenanceHistory: vehicleMaintenance,
        monthRevenue,
        utilizationRate,
        totalMaintenanceCost,
        customerCount,
        monthlyChart,
        profitabilityScore,
        recommendation,
      };
    });
  }, [vehicles, bookings, maintenance]);

  const fleetMap = useMemo(() => Object.fromEntries(analytics.map((vehicle) => [vehicle.id, vehicle])), [analytics]);

  const monthOptions = useMemo(() => {
    const values = Array.from(new Set(bookings.map((booking) => formatMonthKey(booking.startDate))));
    return values.sort((a, b) => (a < b ? 1 : -1));
  }, [bookings]);

  const filteredVehicles = useMemo(() => {
    return analytics.filter((vehicle) => {
      const matchesSearch = [vehicle.name, vehicle.plate, vehicle.brand, vehicle.model]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" ? true : vehicle.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [analytics, search, statusFilter]);

  const selectedVehicle = selectedVehicleId ? fleetMap[selectedVehicleId] : null;

  const filteredVehicleBookings = useMemo(() => {
    if (!selectedVehicle) return [];
    return selectedVehicle.bookings.filter((booking) => {
      if (bookingMonthFilter === "all") return true;
      return formatMonthKey(booking.startDate) === bookingMonthFilter;
    });
  }, [selectedVehicle, bookingMonthFilter]);

  useEffect(() => {
    const status = searchParams.get("status");
    const vehicleId = searchParams.get("vehicleId");
    const focusTab = searchParams.get("tab");

    if (status && STATUS_OPTIONS.includes(status)) {
      setStatusFilter(status);
    }
    if (vehicleId) {
      setSelectedVehicleId(vehicleId);
    }
    if (focusTab && DETAIL_TABS.some((tab) => tab.key === focusTab)) {
      setDetailTab(focusTab);
    }
    if (location.state?.vehicleId) {
      setSelectedVehicleId(location.state.vehicleId);
    }
  }, [location.state, searchParams]);

  function openCreateModal() {
    setFormMode("create");
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  }

  function openEditModal(vehicle) {
    setFormMode("edit");
    setFormData({
      id: vehicle.id,
      name: vehicle.name,
      brand: vehicle.brand,
      model: vehicle.model,
      year: String(vehicle.year),
      plate: vehicle.plate,
      chassisNumber: vehicle.chassisNumber,
      engineNumber: vehicle.engineNumber,
      color: vehicle.color,
      seats: String(vehicle.seats),
      category: vehicle.category,
      dailyRate: String(vehicle.dailyRate),
      hourlyRate: String(vehicle.hourlyRate),
      transmission: vehicle.transmission,
      fuel: vehicle.fuel,
      stnkExpiry: vehicle.stnkExpiry,
      kirExpiry: vehicle.kirExpiry,
      insuranceExpiry: vehicle.insuranceExpiry,
      status: vehicle.status,
      location: vehicle.location,
      imageEmoji: vehicle.imageEmoji,
    });
    setFormErrors({});
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setFormErrors({});
  }

  function validateForm(values) {
    const errors = {};
    if (!values.name.trim()) errors.name = "Nama kendaraan wajib diisi.";
    if (!values.brand.trim()) errors.brand = "Merk wajib diisi.";
    if (!values.model.trim()) errors.model = "Model wajib diisi.";
    if (!values.plate.trim()) errors.plate = "Nomor plat wajib diisi.";
    if (!values.year || Number(values.year) < 2000) errors.year = "Tahun tidak valid.";
    if (!values.seats || Number(values.seats) < 2) errors.seats = "Kapasitas minimal 2.";
    if (!values.dailyRate || Number(values.dailyRate) <= 0) errors.dailyRate = "Tarif harian wajib diisi.";
    if (!values.hourlyRate || Number(values.hourlyRate) <= 0) errors.hourlyRate = "Tarif per jam wajib diisi.";
    if (!values.stnkExpiry) errors.stnkExpiry = "Tanggal STNK wajib diisi.";
    if (!values.kirExpiry) errors.kirExpiry = "Tanggal KIR wajib diisi.";
    if (!values.insuranceExpiry) errors.insuranceExpiry = "Tanggal asuransi wajib diisi.";
    if (!values.location.trim()) errors.location = "Lokasi kendaraan wajib diisi.";
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    const payload = {
      id: formMode === "create" ? `VH-${String(rawVehicles.length + 1).padStart(3, "0")}` : formData.id,
      name: formData.name.trim(),
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      year: Number(formData.year),
      plate: formData.plate.trim().toUpperCase(),
      chassisNumber: formData.chassisNumber.trim(),
      engineNumber: formData.engineNumber.trim(),
      color: formData.color.trim(),
      seats: Number(formData.seats),
      category: formData.category,
      dailyRate: Number(formData.dailyRate),
      hourlyRate: Number(formData.hourlyRate),
      transmission: formData.transmission,
      fuel: formData.fuel,
      stnkExpiry: formData.stnkExpiry,
      kirExpiry: formData.kirExpiry,
      insuranceExpiry: formData.insuranceExpiry,
      status: formData.status,
      location: formData.location.trim(),
      imageEmoji: formData.imageEmoji || "🚘",
      type: formData.model.trim().split(" ")[0] || formData.model.trim(),
      odometer: formMode === "edit" ? fleetMap[formData.id]?.odometer ?? 0 : 0,
      lastService: formMode === "edit" ? fleetMap[formData.id]?.lastService ?? TODAY.toISOString().slice(0, 10) : TODAY.toISOString().slice(0, 10),
      nextService: formMode === "edit" ? fleetMap[formData.id]?.nextService ?? createDocDate(TODAY, 90) : createDocDate(TODAY, 90),
      imageUrl: formMode === "edit" ? fleetMap[formData.id]?.imageUrl ?? "" : "",
    };

    setSaving(true);
    await simulateSave(() => {
      if (formMode === "create") {
        dispatch({ type: "ADD", entity: "vehicles", payload });
      } else {
        dispatch({ type: "UPDATE", entity: "vehicles", id: payload.id, payload });
      }
      setIsFormOpen(false);
    });
    pushToast({
      type: "success",
      title: formMode === "create" ? "Kendaraan berhasil ditambahkan" : "Kendaraan berhasil diperbarui",
      message: payload.name,
    });
    setSaving(false);
  }

  async function handleStatusUpdate(vehicleId, status) {
    setSaving(true);
    setActionMenuId(null);
    await simulateSave(() => {
      dispatch({ type: "UPDATE_STATUS", entity: "vehicles", id: vehicleId, status });
    });
    pushToast({
      type: "info",
      title: "Status armada diperbarui",
      message: `Status kendaraan berubah menjadi ${STATUS_META[status]?.label ?? status}.`,
    });
    setSaving(false);
  }

  async function handleDelete(vehicleId) {
    const confirmed = window.confirm("Hapus kendaraan ini dari armada?");
    if (!confirmed) return;
    setSaving(true);
    setActionMenuId(null);
    await simulateSave(() => {
      dispatch({ type: "DELETE", entity: "vehicles", id: vehicleId });
      if (selectedVehicleId === vehicleId) setSelectedVehicleId(null);
    });
    pushToast({
      type: "success",
      title: "Kendaraan berhasil dihapus",
      message: "Data armada sudah diperbarui.",
    });
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <Car className="h-4 w-4" />
              Fleet control room
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Manajemen Armada</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Kelola status kendaraan, dokumen, performa revenue, dan kesiapan operasional armada dalam satu layar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryPill label="Total Armada" value={vehicles.length} />
            <SummaryPill label="Tersedia" value={vehicles.filter((item) => item.status === "available").length} />
            <SummaryPill label="Disewa" value={vehicles.filter((item) => item.status === "rented").length} />
            <SummaryPill label="Servis" value={vehicles.filter((item) => item.status === "maintenance").length} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama kendaraan atau plat nomor..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-teal focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                <span className="text-sm text-slate-500">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 bg-transparent text-sm font-medium text-slate-700 outline-none"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? "Semua" : STATUS_META[status].label}
                    </option>
                  ))}
                </select>
              </label>

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
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal px-5 text-sm font-semibold text-white transition hover:bg-teal-dark"
          >
            <Plus className="h-4 w-4" />
            Tambah Kendaraan
          </button>
        </div>
      </section>

      {viewMode === "grid" ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              actionMenuId={actionMenuId}
              onOpen={() => {
                setSelectedVehicleId(vehicle.id);
                setDetailTab("info");
              }}
              onEdit={() => openEditModal(vehicle)}
              onHistory={() => navigate(`/bookings?vehicleId=${vehicle.id}`)}
              onToggleMenu={() => setActionMenuId(actionMenuId === vehicle.id ? null : vehicle.id)}
              onAction={handleStatusUpdate}
              onDelete={handleDelete}
              onNavigate={navigate}
            />
          ))}
        </div>
      ) : null}

      {viewMode === "list" ? (
        <div className="space-y-4">
          {filteredVehicles.map((vehicle) => (
            <VehicleListItem
              key={vehicle.id}
              vehicle={vehicle}
              actionMenuId={actionMenuId}
              onOpen={() => {
                setSelectedVehicleId(vehicle.id);
                setDetailTab("info");
              }}
              onEdit={() => openEditModal(vehicle)}
              onHistory={() => navigate(`/bookings?vehicleId=${vehicle.id}`)}
              onToggleMenu={() => setActionMenuId(actionMenuId === vehicle.id ? null : vehicle.id)}
              onAction={handleStatusUpdate}
              onDelete={handleDelete}
              onNavigate={navigate}
            />
          ))}
        </div>
      ) : null}

      {viewMode === "table" ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Kendaraan</th>
                  <th className="px-5 py-4 font-semibold">Plat</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Revenue Bulan Ini</th>
                  <th className="px-5 py-4 font-semibold">Utilization</th>
                  <th className="px-5 py-4 font-semibold">Dokumen</th>
                  <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t border-slate-200">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                          {vehicle.imageEmoji}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{vehicle.name}</p>
                          <p className="text-slate-500">{vehicle.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">{vehicle.plate}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={vehicle.status} />
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{formatRupiah(vehicle.monthRevenue)}</td>
                    <td className="px-5 py-4">
                      <UtilizationBar value={vehicle.utilizationRate} />
                    </td>
                    <td className="px-5 py-4">
                      <DocumentInline expiry={vehicle.stnkExpiry} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton onClick={() => setSelectedVehicleId(vehicle.id)} icon={Eye} label="Detail" />
                        <ActionButton onClick={() => openEditModal(vehicle)} icon={Pencil} label="Edit" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {filteredVehicles.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="Belum ada kendaraan yang cocok"
          message="Coba ubah kata kunci pencarian atau filter status untuk melihat unit lain."
          actionLabel="Reset Filter"
          onAction={() => {
            setSearch("");
            setStatusFilter("all");
          }}
        />
      ) : null}

      {selectedVehicle ? (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          detailTab={detailTab}
          onTabChange={setDetailTab}
          bookingMonthFilter={bookingMonthFilter}
          onBookingMonthFilterChange={setBookingMonthFilter}
          filteredBookings={filteredVehicleBookings}
          monthOptions={monthOptions}
          onClose={() => setSelectedVehicleId(null)}
          onEdit={() => openEditModal(selectedVehicle)}
        />
      ) : null}

      {isFormOpen ? (
        <VehicleFormModal
          mode={formMode}
          formData={formData}
          formErrors={formErrors}
          saving={saving}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))}
        />
      ) : null}

      {saving ? (
        <div className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-xl">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Menyimpan perubahan armada...
        </div>
      ) : null}
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{formatNumber(value)}</p>
    </div>
  );
}

function VehicleCard({
  vehicle,
  actionMenuId,
  onOpen,
  onEdit,
  onHistory,
  onToggleMenu,
  onAction,
  onDelete,
  onNavigate,
}) {
  const stnkMeta = getDocumentMeta(vehicle.stnkExpiry);

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 gap-4 text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-slate-100 text-5xl">
            {vehicle.imageEmoji}
          </div>
          <div className="min-w-0">
            <StatusBadge status={vehicle.status} />
            <h3 className="mt-3 truncate text-lg font-bold text-slate-900">{vehicle.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{vehicle.plate}</p>
          </div>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {actionMenuId === vehicle.id ? (
            <QuickActionMenu vehicle={vehicle} onAction={onAction} onDelete={onDelete} />
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatBox label="Kapasitas" value={`${vehicle.seats} pax`} />
        <StatBox label="Odometer" value={`${formatNumber(vehicle.odometer)} km`} />
        <StatBox label="Revenue bulan ini" value={formatRupiah(vehicle.monthRevenue, { compact: true })} />
        <StatBox label="Utilization" value={`${vehicle.utilizationRate}%`} />
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">Status STNK</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${stnkMeta.tone}`}>
            {stnkMeta.label}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-800">{vehicle.stnkExpiry}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton onClick={onOpen} icon={Eye} label="Detail" />
        <ActionButton onClick={onEdit} icon={Pencil} label="Edit" />
        <ActionButton onClick={onHistory} icon={Clock3} label="Riwayat" />
        <ActionButton onClick={() => onNavigate("/gps")} icon={MapPin} label="GPS" />
      </div>
    </article>
  );
}

function VehicleListItem({
  vehicle,
  actionMenuId,
  onOpen,
  onEdit,
  onHistory,
  onToggleMenu,
  onAction,
  onDelete,
  onNavigate,
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button type="button" onClick={onOpen} className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-slate-100 text-5xl">
            {vehicle.imageEmoji}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="truncate text-lg font-bold text-slate-900">{vehicle.name}</h3>
              <StatusBadge status={vehicle.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {vehicle.plate} • {vehicle.seats} pax • {vehicle.location}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <StatBox label="Revenue bulan ini" value={formatRupiah(vehicle.monthRevenue, { compact: true })} />
              <StatBox label="Utilization" value={`${vehicle.utilizationRate}%`} />
              <StatBox label="Odometer" value={`${formatNumber(vehicle.odometer)} km`} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton onClick={onOpen} icon={Eye} label="Detail" />
          <ActionButton onClick={onEdit} icon={Pencil} label="Edit" />
          <ActionButton onClick={onHistory} icon={Clock3} label="Riwayat" />
          <ActionButton onClick={() => onNavigate("/gps")} icon={MapPin} label="GPS" />
          <div className="relative">
            <button
              type="button"
              onClick={onToggleMenu}
              className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {actionMenuId === vehicle.id ? (
              <QuickActionMenu vehicle={vehicle} onAction={onAction} onDelete={onDelete} />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function VehicleDetailModal({
  vehicle,
  detailTab,
  onTabChange,
  bookingMonthFilter,
  onBookingMonthFilterChange,
  filteredBookings,
  monthOptions,
  onClose,
  onEdit,
}) {
  const stnkMeta = getDocumentMeta(vehicle.stnkExpiry);
  const kirMeta = getDocumentMeta(vehicle.kirExpiry);
  const insuranceMeta = getDocumentMeta(vehicle.insuranceExpiry);
  const totalBookingRevenue = filteredBookings.reduce((sum, booking) => sum + booking.total, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-0 sm:p-4">
      <div className="animate-modal-in flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-slate-100 text-5xl">
              {vehicle.imageEmoji}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="truncate text-2xl font-bold text-slate-900">{vehicle.name}</h3>
                <StatusBadge status={vehicle.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {vehicle.plate} • {vehicle.location} • {vehicle.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6">
          <div className="flex flex-wrap gap-2 py-3">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  detailTab === tab.key ? "bg-navy text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {detailTab === "info" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-6">
                <SectionBox title="Data Teknis">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoItem label="Merk" value={vehicle.brand} />
                    <InfoItem label="Model" value={vehicle.model} />
                    <InfoItem label="Tahun" value={vehicle.year} />
                    <InfoItem label="Transmisi" value={vehicle.transmission} />
                    <InfoItem label="Bahan Bakar" value={vehicle.fuel} />
                    <InfoItem label="Warna" value={vehicle.color} />
                    <InfoItem label="Nomor Plat" value={vehicle.plate} />
                    <InfoItem label="Nomor Rangka" value={vehicle.chassisNumber} />
                    <InfoItem label="Nomor Mesin" value={vehicle.engineNumber} />
                    <InfoItem label="Kapasitas" value={`${vehicle.seats} penumpang`} />
                    <InfoItem label="Tarif Harian" value={formatRupiah(vehicle.dailyRate)} />
                    <InfoItem label="Tarif Per Jam" value={formatRupiah(vehicle.hourlyRate)} />
                  </div>
                </SectionBox>

                <SectionBox title="Foto Galeri">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((slot) => (
                      <div
                        key={slot}
                        className="flex h-36 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center"
                      >
                        <div>
                          <div className="text-4xl">{vehicle.imageEmoji}</div>
                          <p className="mt-2 text-sm text-slate-500">Upload area foto #{slot}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionBox>
              </div>

              <div className="space-y-6">
                <SectionBox title="Dokumen Kendaraan">
                  <div className="space-y-4">
                    <DocumentCard title="STNK" expiry={vehicle.stnkExpiry} meta={stnkMeta} />
                    <DocumentCard title="KIR" expiry={vehicle.kirExpiry} meta={kirMeta} />
                    <DocumentCard title="Asuransi" expiry={vehicle.insuranceExpiry} meta={insuranceMeta} />
                  </div>
                </SectionBox>

                <SectionBox title="Ringkasan Operasional">
                  <div className="space-y-3">
                    <MiniStat icon={BarChart3} label="Revenue bulan ini" value={formatRupiah(vehicle.monthRevenue)} />
                    <MiniStat icon={Gauge} label="Utilization rate" value={`${vehicle.utilizationRate}%`} />
                    <MiniStat icon={Wrench} label="Total biaya maintenance" value={formatRupiah(vehicle.totalMaintenanceCost)} />
                    <MiniStat icon={Activity} label="Profitability score" value={`${vehicle.profitabilityScore}/100`} />
                  </div>
                </SectionBox>
              </div>
            </div>
          ) : null}

          {detailTab === "bookings" ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Riwayat Penyewaan</h4>
                  <p className="text-sm text-slate-500">Filter data booking berdasarkan bulan untuk unit ini.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                    <span className="text-sm text-slate-500">Bulan</span>
                    <select
                      value={bookingMonthFilter}
                      onChange={(event) => onBookingMonthFilterChange(event.target.value)}
                      className="h-11 bg-transparent text-sm font-medium text-slate-700 outline-none"
                    >
                      <option value="all">Semua</option>
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {monthLabel(month)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    Total revenue: {formatRupiah(totalBookingRevenue)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Booking</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Periode</th>
                      <th className="px-4 py-3 font-semibold">Hari</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">{booking.id}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {customers.find((item) => item.id === booking.customerId)?.name ?? booking.customerId}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {booking.startDate} s/d {booking.endDate}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{booking.totalDays} hari</td>
                        <td className="px-4 py-3 text-slate-600">{booking.status}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(booking.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {detailTab === "maintenance" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SectionBox title="Timeline Riwayat Servis">
                <div className="space-y-5">
                  {vehicle.maintenanceHistory.map((item, index) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                          <Wrench className="h-4 w-4" />
                        </div>
                        {index !== vehicle.maintenanceHistory.length - 1 ? (
                          <div className="mt-2 h-full w-px bg-slate-200" />
                        ) : null}
                      </div>
                      <div className="pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{item.type}</h4>
                          <span className="text-xs text-slate-400">{item.date}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          {item.vendor} • {formatRupiah(item.cost)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionBox>

              <div className="space-y-6">
                <SectionBox title="Jadwal Servis Berikutnya">
                  <MiniStat icon={CalendarClock} label="Next service" value={vehicle.nextService} />
                  <MiniStat icon={Clock3} label="Sisa hari" value={`${Math.max(diffDays(vehicle.nextService, TODAY), 0)} hari`} />
                  <MiniStat icon={Gauge} label="Odometer" value={`${formatNumber(vehicle.odometer)} km`} />
                </SectionBox>

                <SectionBox title="Total Biaya Perawatan">
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="text-sm text-slate-500">Akumulasi seluruh maintenance</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{formatRupiah(vehicle.totalMaintenanceCost)}</p>
                  </div>
                </SectionBox>
              </div>
            </div>
          ) : null}

          {detailTab === "analytics" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
              <div className="space-y-6">
                <SectionBox title="Utilization Rate per Bulan">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={vehicle.monthlyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={12} />
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#64748b"
                          fontSize={12}
                          tickFormatter={(value) => formatRupiah(value, { compact: true })}
                        />
                        <Tooltip
                          formatter={(value, name) =>
                            name === "utilization" ? `${value}%` : formatRupiah(Number(value))
                          }
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                          }}
                        />
                        <Bar yAxisId="left" dataKey="utilization" fill="#00b8a9" radius={[10, 10, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#0d1f4e" strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </SectionBox>

                <SectionBox title="Revenue vs Biaya Maintenance">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={vehicle.monthlyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={12} />
                        <YAxis
                          stroke="#64748b"
                          fontSize={12}
                          tickFormatter={(value) => formatRupiah(value, { compact: true })}
                        />
                        <Tooltip
                          formatter={(value) => formatRupiah(Number(value))}
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                          }}
                        />
                        <Bar dataKey="revenue" fill="#0d1f4e" radius={[10, 10, 0, 0]} />
                        <Line type="monotone" dataKey="maintenanceCost" stroke="#f59e0b" strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </SectionBox>
              </div>

              <div className="space-y-6">
                <SectionBox title="Profitability Score">
                  <div className="rounded-[2rem] bg-gradient-to-br from-navy to-teal p-5 text-white">
                    <p className="text-sm text-white/70">AI recommendation</p>
                    <p className="mt-3 text-4xl font-bold">{vehicle.profitabilityScore}/100</p>
                    <p className="mt-4 text-sm leading-6 text-white/80">{vehicle.recommendation}</p>
                  </div>
                </SectionBox>

                <SectionBox title="Signals">
                  <MiniStat icon={BarChart3} label="Revenue bulan ini" value={formatRupiah(vehicle.monthRevenue)} />
                  <MiniStat icon={Wrench} label="Biaya maintenance" value={formatRupiah(vehicle.totalMaintenanceCost)} />
                  <MiniStat icon={Activity} label="Customer unik" value={`${vehicle.customerCount} customer`} />
                </SectionBox>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VehicleFormModal({ mode, formData, formErrors, saving, onClose, onSubmit, onChange }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-0 sm:p-4">
      <div className="animate-modal-in h-full w-full overflow-y-auto bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-4xl sm:rounded-[2rem]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {mode === "create" ? "Tambah Kendaraan" : "Edit Kendaraan"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">Lengkapi form armada dengan validasi dasar dan preview visual.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 px-6 py-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Kendaraan" error={formErrors.name}>
                <input
                  value={formData.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  className={inputClass(formErrors.name)}
                  placeholder="Toyota Hiace Premio 2024"
                />
              </Field>
              <Field label="Merk" error={formErrors.brand}>
                <input value={formData.brand} onChange={(event) => onChange("brand", event.target.value)} className={inputClass(formErrors.brand)} />
              </Field>
              <Field label="Model" error={formErrors.model}>
                <input value={formData.model} onChange={(event) => onChange("model", event.target.value)} className={inputClass(formErrors.model)} />
              </Field>
              <Field label="Tahun" error={formErrors.year}>
                <input type="number" value={formData.year} onChange={(event) => onChange("year", event.target.value)} className={inputClass(formErrors.year)} />
              </Field>
              <Field label="Nomor Plat" error={formErrors.plate}>
                <input value={formData.plate} onChange={(event) => onChange("plate", event.target.value)} className={inputClass(formErrors.plate)} />
              </Field>
              <Field label="Nomor Rangka">
                <input value={formData.chassisNumber} onChange={(event) => onChange("chassisNumber", event.target.value)} className={inputClass()} />
              </Field>
              <Field label="Nomor Mesin">
                <input value={formData.engineNumber} onChange={(event) => onChange("engineNumber", event.target.value)} className={inputClass()} />
              </Field>
              <Field label="Warna">
                <input value={formData.color} onChange={(event) => onChange("color", event.target.value)} className={inputClass()} />
              </Field>
              <Field label="Kapasitas Penumpang" error={formErrors.seats}>
                <input type="number" value={formData.seats} onChange={(event) => onChange("seats", event.target.value)} className={inputClass(formErrors.seats)} />
              </Field>
              <Field label="Jenis">
                <select value={formData.category} onChange={(event) => onChange("category", event.target.value)} className={inputClass()}>
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Harga Sewa per Hari" error={formErrors.dailyRate}>
                <input type="number" value={formData.dailyRate} onChange={(event) => onChange("dailyRate", event.target.value)} className={inputClass(formErrors.dailyRate)} />
              </Field>
              <Field label="Harga Sewa per Jam" error={formErrors.hourlyRate}>
                <input type="number" value={formData.hourlyRate} onChange={(event) => onChange("hourlyRate", event.target.value)} className={inputClass(formErrors.hourlyRate)} />
              </Field>
              <Field label="STNK Expire" error={formErrors.stnkExpiry}>
                <input type="date" value={formData.stnkExpiry} onChange={(event) => onChange("stnkExpiry", event.target.value)} className={inputClass(formErrors.stnkExpiry)} />
              </Field>
              <Field label="KIR Expire" error={formErrors.kirExpiry}>
                <input type="date" value={formData.kirExpiry} onChange={(event) => onChange("kirExpiry", event.target.value)} className={inputClass(formErrors.kirExpiry)} />
              </Field>
              <Field label="Asuransi Expire" error={formErrors.insuranceExpiry}>
                <input
                  type="date"
                  value={formData.insuranceExpiry}
                  onChange={(event) => onChange("insuranceExpiry", event.target.value)}
                  className={inputClass(formErrors.insuranceExpiry)}
                />
              </Field>
              <Field label="Status Awal">
                <select value={formData.status} onChange={(event) => onChange("status", event.target.value)} className={inputClass()}>
                  {STATUS_OPTIONS.filter((item) => item !== "all").map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lokasi" error={formErrors.location}>
                <input value={formData.location} onChange={(event) => onChange("location", event.target.value)} className={inputClass(formErrors.location)} />
              </Field>
              <Field label="Preview Emoji Foto">
                <input value={formData.imageEmoji} onChange={(event) => onChange("imageEmoji", event.target.value)} className={inputClass()} maxLength={2} />
              </Field>
            </div>

            <div className="space-y-4">
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <div className="text-7xl">{formData.imageEmoji || "🚘"}</div>
                <p className="mt-3 text-sm text-slate-500">Upload foto kendaraan (simulasi preview placeholder)</p>
              </div>

              <div className="rounded-[2rem] bg-slate-50 p-5">
                <h4 className="font-semibold text-slate-900">Preview Singkat</h4>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <PreviewRow label="Nama" value={formData.name || "-"} />
                  <PreviewRow label="Plat" value={formData.plate || "-"} />
                  <PreviewRow label="Kategori" value={formData.category || "-"} />
                  <PreviewRow label="Tarif Harian" value={formData.dailyRate ? formatRupiah(formData.dailyRate) : "-"} />
                  <PreviewRow label="Status" value={STATUS_META[formData.status]?.label ?? "-"} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickActionMenu({ vehicle, onAction, onDelete }) {
  return (
    <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      <QuickActionItem label="Tandai Tersedia" onClick={() => onAction(vehicle.id, "available")} />
      <QuickActionItem label="Tandai Dalam Servis" onClick={() => onAction(vehicle.id, "maintenance")} />
      <QuickActionItem label="Nonaktifkan" onClick={() => onAction(vehicle.id, "inactive")} />
      <QuickActionItem label="Hapus" danger onClick={() => onDelete(vehicle.id)} />
    </div>
  );
}

function QuickActionItem({ label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
        danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
      <ChevronDown className="h-4 w-4 -rotate-90" />
    </button>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_META[status].badge}`}>
      {STATUS_META[status].label}
    </span>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function UtilizationBar({ value }) {
  return (
    <div className="w-40">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-teal" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function DocumentInline({ expiry }) {
  const meta = getDocumentMeta(expiry);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.tone}`}>{meta.label}</span>;
}

function SectionBox({ title, children }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-lg font-bold text-slate-900">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DocumentCard({ title, expiry, meta }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
            <FileBadge2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{expiry}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.tone}`}>{meta.label}</span>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

function inputClass(error) {
  return `h-11 w-full rounded-2xl border bg-slate-50 px-4 text-sm outline-none transition focus:bg-white ${
    error ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-teal"
  }`;
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
