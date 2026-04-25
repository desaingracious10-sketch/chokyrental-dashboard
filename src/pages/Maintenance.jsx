import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  ClipboardList,
  Plus,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation, useSearchParams } from "react-router-dom";
import { TODAY, addDays, addMonths, diffDays, formatNumber, formatRupiah, isSameMonth, startOfDay } from "../lib/format";
import { useAppContext } from "../context/AppContext";
import EmptyState from "../components/ui/EmptyState";

const SERVICE_TYPES = [
  "Servis Rutin",
  "Perbaikan",
  "Ganti Ban",
  "Ganti Oli",
  "Listrik",
  "Body",
  "Lainnya",
];

const EMPTY_FORM = {
  vehicleId: "",
  date: TODAY.toISOString().slice(0, 10),
  type: SERVICE_TYPES[0],
  vendor: "",
  odometer: "",
  jobs: ["Pemeriksaan umum"],
  parts: [{ name: "Oli mesin", qty: "1", price: "0" }],
  nextServiceDate: addMonths(TODAY, 3).toISOString().slice(0, 10),
  nextServiceOdometer: "",
  proofName: "",
  notes: "",
};

const VEHICLE_EMOJI = {
  "Hiace Premio": "🚐",
  Innova: "🚘",
  Rush: "🚙",
  Jazz: "🚗",
  Elf: "🚌",
  default: "🚘",
};

function createDocDate(baseDate, offsetDays) {
  const value = new Date(baseDate);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function normalizeVehicle(vehicle, index) {
  const anchor = startOfDay(TODAY);
  return {
    ...vehicle,
    emoji: VEHICLE_EMOJI[vehicle.type] ?? VEHICLE_EMOJI.default,
    stnkExpiry: createDocDate(anchor, 10 + index * 17),
    kirExpiry: createDocDate(anchor, 21 + index * 13),
    insuranceExpiry: createDocDate(anchor, 35 + index * 12),
  };
}

function normalizeMaintenance(record, index) {
  const typeMap = {
    "Service Berkala": "Servis Rutin",
    "Service Ringan": "Ganti Oli",
    Perbaikan: "Perbaikan",
  };
  return {
    ...record,
    kind: typeMap[record.type] ?? record.type,
    proofName: `bukti-servis-${index + 1}.jpg`,
    jobs: record.description.split(",").map((item) => item.trim()),
    parts: [
      {
        name: record.type.includes("Perbaikan") ? "Part pengganti" : "Consumable",
        qty: 1,
        price: Math.round(record.cost * 0.45),
      },
    ],
    notes: record.description,
  };
}

function getAlertTone(level) {
  if (level === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function monthKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return new Date(date).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

export default function Maintenance() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    state: { vehicles: rawVehicles, maintenance: maintenanceState, bookings },
    dispatch,
    pushToast,
  } = useAppContext();
  const vehicles = useMemo(() => rawVehicles.map(normalizeVehicle), [rawVehicles]);
  const records = useMemo(() => maintenanceState.map(normalizeMaintenance), [maintenanceState]);
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(TODAY.toISOString().slice(0, 10));

  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (vehicleFilter !== "all" && record.vehicleId !== vehicleFilter) return false;
      if (typeFilter !== "all" && record.kind !== typeFilter) return false;
      if (periodFilter !== "all" && monthKey(record.date) !== periodFilter) return false;
      return true;
    });
  }, [records, vehicleFilter, typeFilter, periodFilter]);

  const alerts = useMemo(() => {
    const serviceOverdue = vehicles
      .filter((vehicle) => diffDays(TODAY, vehicle.nextService) > 0)
      .map((vehicle) => ({
        id: `svc-over-${vehicle.id}`,
        title: "Jadwal servis sudah lewat",
        description: `${vehicle.name} terlambat servis ${diffDays(TODAY, vehicle.nextService)} hari.`,
        level: "danger",
      }));

    const serviceSoon = vehicles
      .filter((vehicle) => {
        const days = diffDays(vehicle.nextService, TODAY);
        return days >= 0 && days < 7;
      })
      .map((vehicle) => ({
        id: `svc-soon-${vehicle.id}`,
        title: "Servis kurang dari 7 hari",
        description: `${vehicle.name} perlu servis pada ${vehicle.nextService}.`,
        level: "warning",
      }));

    const docs = [
      ["STNK", "stnkExpiry"],
      ["KIR", "kirExpiry"],
      ["Asuransi", "insuranceExpiry"],
    ];

    const documentAlerts = docs.flatMap(([label, field]) =>
      vehicles
        .filter((vehicle) => diffDays(vehicle[field], TODAY) < 30)
        .map((vehicle) => ({
          id: `${field}-${vehicle.id}`,
          title: `${label} mau expire`,
          description: `${label} ${vehicle.name} jatuh tempo ${vehicle[field]}.`,
          level: diffDays(vehicle[field], TODAY) < 0 ? "danger" : "warning",
        })),
    );

    return [...serviceOverdue, ...serviceSoon, ...documentAlerts];
  }, [vehicles]);

  const upcomingSchedule = useMemo(() => {
    return vehicles
      .map((vehicle) => ({
        ...vehicle,
        nextKmTarget: Math.ceil(vehicle.odometer / 5000) * 5000 + 5000,
      }))
      .sort((a, b) => new Date(a.nextService) - new Date(b.nextService));
  }, [vehicles]);

  const periodOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((record) => monthKey(record.date))));
    return values.sort((a, b) => (a < b ? 1 : -1));
  }, [records]);

  const analyticsData = useMemo(() => {
    const months = Array.from({ length: 4 }, (_, index) => addMonths(TODAY, index - 3));
    return vehicles.map((vehicle) => ({
      name: vehicle.type,
      fullName: vehicle.name,
      totalMaintenance: records.filter((record) => record.vehicleId === vehicle.id).reduce((sum, record) => sum + record.cost, 0),
      totalRevenue: bookings.filter((booking) => booking.vehicleId === vehicle.id).reduce((sum, booking) => sum + booking.total, 0),
      monthly: months.map((month) => ({
        month: monthLabel(month),
        cost: records
          .filter((record) => record.vehicleId === vehicle.id && isSameMonth(new Date(record.date), month))
          .reduce((sum, record) => sum + record.cost, 0),
      })),
    }));
  }, [vehicles, records]);

  const monthlyCostChart = useMemo(() => {
    const latestMonth = monthLabel(TODAY);
    return analyticsData.map((item) => ({
      name: item.name,
      latestMonth,
      cost: item.monthly[item.monthly.length - 1]?.cost ?? 0,
    }));
  }, [analyticsData]);

  function openCreateForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditForm(record) {
    setEditingId(record.id);
    setFormData({
      vehicleId: record.vehicleId,
      date: record.date,
      type: record.kind,
      vendor: record.vendor,
      odometer: String(record.odometer),
      jobs: record.jobs.length ? record.jobs : [""],
      parts: record.parts.length
        ? record.parts.map((part) => ({ name: part.name, qty: String(part.qty), price: String(part.price) }))
        : [{ name: "", qty: "1", price: "0" }],
      nextServiceDate: addMonths(record.date, 3).toISOString().slice(0, 10),
      nextServiceOdometer: String((record.odometer ?? 0) + 5000),
      proofName: record.proofName,
      notes: record.notes,
    });
    setIsFormOpen(true);
  }

  function saveRecord(event) {
    event.preventDefault();
    const totalParts = formData.parts.reduce((sum, part) => sum + (Number(part.qty) || 0) * (Number(part.price) || 0), 0);
    const payload = {
      id: editingId ?? `MNT-${String(records.length + 1).padStart(3, "0")}`,
      vehicleId: formData.vehicleId,
      date: formData.date,
      type: formData.type,
      kind: formData.type,
      description: formData.jobs.filter(Boolean).join(", "),
      cost: totalParts,
      vendor: formData.vendor,
      odometer: Number(formData.odometer) || 0,
      status: "completed",
      jobs: formData.jobs.filter(Boolean),
      parts: formData.parts.map((part) => ({
        name: part.name,
        qty: Number(part.qty) || 0,
        price: Number(part.price) || 0,
      })),
      notes: formData.notes,
      proofName: formData.proofName || "bukti-servis-baru.jpg",
    };

    if (editingId) {
      dispatch({ type: "UPDATE", entity: "maintenance", id: editingId, payload });
    } else {
      dispatch({ type: "ADD", entity: "maintenance", payload });
    }
    setIsFormOpen(false);
    pushToast({
      type: "success",
      title: editingId ? "Record servis diperbarui" : "Record servis berhasil disimpan",
      message: payload.kind,
    });
  }

  function removeRecord(recordId) {
    dispatch({ type: "DELETE", entity: "maintenance", id: recordId });
    pushToast({
      type: "success",
      title: "Record servis dihapus",
      message: "Timeline maintenance sudah diperbarui.",
    });
  }

  const scheduledForDate = upcomingSchedule.filter((vehicle) => vehicle.nextService === selectedDate);

  useEffect(() => {
    const vehicleId = searchParams.get("vehicleId") ?? location.state?.vehicleId;
    if (vehicleId) {
      setVehicleFilter(vehicleId);
    }
  }, [location.state, searchParams]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <Wrench className="h-4 w-4" />
              Maintenance operations board
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Maintenance Management</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Pantau alert servis, timeline perawatan, jadwal mendatang, dan analitik biaya armada dalam satu halaman.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-navy"
          >
            <Plus className="h-4 w-4" />
            Tambah Record Servis
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            title: "Servis Sudah Lewat",
            count: alerts.filter((alert) => alert.title.includes("sudah lewat")).length,
            level: "danger",
          },
          {
            title: "Servis < 7 Hari",
            count: alerts.filter((alert) => alert.title.includes("kurang dari 7")).length,
            level: "warning",
          },
          {
            title: "STNK Mau Expire",
            count: alerts.filter((alert) => alert.title.includes("STNK")).length,
            level: "warning",
          },
          {
            title: "KIR Mau Expire",
            count: alerts.filter((alert) => alert.title.includes("KIR")).length,
            level: "warning",
          },
          {
            title: "Asuransi Mau Expire",
            count: alerts.filter((alert) => alert.title.includes("Asuransi")).length,
            level: "warning",
          },
        ].map((item) => (
          <button
            type="button"
            key={item.title}
            onClick={() => setVehicleFilter("all")}
            className={`rounded-3xl border p-5 text-left shadow-sm ${getAlertTone(item.level)}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-2 text-3xl font-bold">{item.count}</p>
              </div>
              <AlertTriangle className="h-6 w-6" />
            </div>
          </button>
        ))}
      </section>

      {alerts.length > 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Alert Servis Prioritas</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {alerts.slice(0, 6).map((alert) => (
              <button
                type="button"
                key={alert.id}
                onClick={() => {
                  const matchedVehicle = vehicles.find((vehicle) => alert.description.includes(vehicle.name));
                  if (matchedVehicle) {
                    setVehicleFilter(matchedVehicle.id);
                  }
                }}
                className={`w-full rounded-2xl border p-4 text-left ${getAlertTone(alert.level)}`}
              >
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-2 text-sm">{alert.description}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Timeline Maintenance</h3>
              <p className="text-sm text-slate-500">Riwayat seluruh maintenance dengan filter kendaraan, jenis servis, dan periode.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FilterSelect
                label="Kendaraan"
                value={vehicleFilter}
                onChange={setVehicleFilter}
                options={["all", ...vehicles.map((vehicle) => vehicle.id)]}
                renderLabel={(value) => value === "all" ? "Semua kendaraan" : vehicleMap[value]?.name ?? value}
              />
              <FilterSelect
                label="Jenis Servis"
                value={typeFilter}
                onChange={setTypeFilter}
                options={["all", ...SERVICE_TYPES]}
                renderLabel={(value) => value === "all" ? "Semua jenis" : value}
              />
              <FilterSelect
                label="Periode"
                value={periodFilter}
                onChange={setPeriodFilter}
                options={["all", ...periodOptions]}
                renderLabel={(value) => value === "all" ? "Semua periode" : value}
              />
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {filteredRecords.length === 0 ? (
              <EmptyState
                icon="🛠️"
                title="Belum ada riwayat servis"
                message="Belum ada data maintenance untuk filter yang dipilih."
                actionLabel="Tambah Record Servis"
                onAction={openCreateForm}
              />
            ) : null}
            {filteredRecords.map((record, index) => {
              const vehicle = vehicleMap[record.vehicleId];
              return (
                <div key={record.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                      <Wrench className="h-4 w-4" />
                    </div>
                    {index !== filteredRecords.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
                  </div>

                  <div className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-bold text-slate-900">{record.kind}</p>
                          <span className="text-sm text-slate-500">{record.date}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {vehicle?.emoji} {vehicle?.name ?? record.vehicleId}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{record.vendor} • KM {formatNumber(record.odometer)}</p>
                        <p className="mt-3 text-sm text-slate-700">{record.description}</p>
                        <p className="mt-2 text-sm font-medium text-slate-500">Catatan: {record.notes}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-2xl bg-white px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Biaya</p>
                          <p className="mt-1 font-bold text-slate-900">{formatRupiah(record.cost)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditForm(record)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecord(record.id)}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-800">Pekerjaan</p>
                        <ul className="mt-2 space-y-1">
                          {record.jobs.map((job) => (
                            <li key={job}>• {job}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex min-w-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        <div>
                          <Camera className="mx-auto h-5 w-5" />
                          <p className="mt-2">{record.proofName}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Jadwal Servis Mendatang</h3>
                <p className="text-sm text-slate-500">Klik tanggal untuk melihat kendaraan yang terjadwal.</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tanggal servis</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {(scheduledForDate.length ? scheduledForDate : upcomingSchedule.slice(0, 5)).map((vehicle) => (
                <div key={vehicle.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{vehicle.emoji} {vehicle.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{vehicle.nextService}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      Next @ {formatNumber(vehicle.nextKmTarget)} km
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cost Analytics</h3>
                <p className="text-sm text-slate-500">Biaya maintenance terbaru dan rasio terhadap revenue kendaraan.</p>
              </div>
            </div>

            <div className="mt-5 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCostChart} margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatRupiah(value, { compact: true })} />
                  <Tooltip formatter={(value) => formatRupiah(value)} />
                  <Bar dataKey="cost" radius={[10, 10, 0, 0]}>
                    {monthlyCostChart.map((item, index) => (
                      <Cell key={item.name} fill={index % 2 === 0 ? "#00b8a9" : "#0d1f4e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {["Kendaraan", "Total Maintenance", "Total Revenue", "Ratio", "Status"].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.map((item) => {
                    const ratio = item.totalRevenue > 0 ? (item.totalMaintenance / item.totalRevenue) * 100 : 0;
                    return (
                      <tr key={item.fullName} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.fullName}</td>
                        <td className="px-4 py-3">{formatRupiah(item.totalMaintenance)}</td>
                        <td className="px-4 py-3">{formatRupiah(item.totalRevenue)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{ratio.toFixed(1)}%</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            ratio > 22 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {ratio > 22 ? "Biaya terlalu tinggi" : "Sehat"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-0 sm:p-4">
          <div className="animate-modal-in h-full w-full overflow-y-auto bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{editingId ? "Edit Record Servis" : "Tambah Record Servis"}</h3>
                <p className="mt-1 text-sm text-slate-500">Lengkapi detail servis, part, biaya, dan jadwal berikutnya.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={saveRecord} className="space-y-6 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FilterSelect
                  label="Kendaraan"
                  value={formData.vehicleId}
                  onChange={(value) => setFormData((current) => ({ ...current, vehicleId: value }))}
                  options={vehicles.map((vehicle) => vehicle.id)}
                  renderLabel={(value) => vehicleMap[value]?.name ?? value}
                />
                <InputField label="Tanggal Servis" type="date" value={formData.date} onChange={(value) => setFormData((current) => ({ ...current, date: value }))} />
                <FilterSelect
                  label="Jenis Servis"
                  value={formData.type}
                  onChange={(value) => setFormData((current) => ({ ...current, type: value }))}
                  options={SERVICE_TYPES}
                  renderLabel={(value) => value}
                />
                <InputField label="Bengkel" value={formData.vendor} onChange={(value) => setFormData((current) => ({ ...current, vendor: value }))} />
                <InputField label="KM Odometer Saat Ini" value={formData.odometer} onChange={(value) => setFormData((current) => ({ ...current, odometer: value, nextServiceOdometer: String((Number(value) || 0) + 5000) }))} />
                <InputField label="Jadwal Servis Berikutnya" type="date" value={formData.nextServiceDate} onChange={(value) => setFormData((current) => ({ ...current, nextServiceDate: value }))} />
                <InputField label="Target KM Servis Berikutnya" value={formData.nextServiceOdometer} onChange={(value) => setFormData((current) => ({ ...current, nextServiceOdometer: value }))} />
                <InputField label="Upload Foto Bukti" value={formData.proofName} onChange={(value) => setFormData((current) => ({ ...current, proofName: value }))} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">Daftar Pekerjaan</h4>
                    <button
                      type="button"
                      onClick={() => setFormData((current) => ({ ...current, jobs: [...current.jobs, ""] }))}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {formData.jobs.map((job, index) => (
                      <div key={`job-${index}`} className="flex gap-2">
                        <input
                          value={job}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              jobs: current.jobs.map((item, jobIndex) => (jobIndex === index ? event.target.value : item)),
                            }))
                          }
                          className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((current) => ({
                              ...current,
                              jobs: current.jobs.filter((_, jobIndex) => jobIndex !== index),
                            }))
                          }
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">Part yang Diganti</h4>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((current) => ({
                          ...current,
                          parts: [...current.parts, { name: "", qty: "1", price: "0" }],
                        }))
                      }
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      + Add Part
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {formData.parts.map((part, index) => (
                      <div key={`part-${index}`} className="grid gap-2 md:grid-cols-[1fr_100px_120px_auto]">
                        <input
                          value={part.name}
                          placeholder="Nama part"
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              parts: current.parts.map((item, partIndex) =>
                                partIndex === index ? { ...item, name: event.target.value } : item,
                              ),
                            }))
                          }
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                        />
                        <input
                          value={part.qty}
                          placeholder="Qty"
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              parts: current.parts.map((item, partIndex) =>
                                partIndex === index ? { ...item, qty: event.target.value } : item,
                              ),
                            }))
                          }
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                        />
                        <input
                          value={part.price}
                          placeholder="Harga"
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              parts: current.parts.map((item, partIndex) =>
                                partIndex === index ? { ...item, price: event.target.value } : item,
                              ),
                            }))
                          }
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((current) => ({
                              ...current,
                              parts: current.parts.filter((_, partIndex) => partIndex !== index),
                            }))
                          }
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-right">
                    <p className="text-sm text-slate-500">Total biaya auto-sum</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {formatRupiah(formData.parts.reduce((sum, part) => sum + (Number(part.qty) || 0) * (Number(part.price) || 0), 0))}
                    </p>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Catatan Tambahan</span>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3 text-sm font-semibold text-white"
                >
                  <Save className="h-4 w-4" />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, renderLabel }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {renderLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
      />
    </label>
  );
}
