import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Car,
  CreditCard,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
  X,
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
import { TODAY, diffDays, formatNumber, formatRupiah, isSameMonth } from "../lib/format";
import { useAppContext } from "../context/AppContext";

const DRIVER_STATUS_META = {
  available: { label: "Tersedia", tone: "bg-emerald-100 text-emerald-700" },
  "on-duty": { label: "Bertugas", tone: "bg-rose-100 text-rose-700" },
  "off-duty": { label: "Cuti", tone: "bg-amber-100 text-amber-700" },
};

const DRIVER_TABS = [
  { key: "profile", label: "Profil" },
  { key: "history", label: "Riwayat Tugas" },
  { key: "payroll", label: "Penggajian" },
];

const EMPTY_DRIVER_FORM = {
  name: "",
  ktp: "",
  license: "SIM A Umum",
  licenseExpiry: TODAY.toISOString().slice(0, 10),
  address: "",
  phone: "",
  emergencyContact: "",
  bankAccount: "",
  baseSalary: "4500000",
};

function getDriverInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function normalizeDriver(driver, index, bookings, transactions, vehicles) {
  const assignedBookings = bookings.filter((booking) => booking.driverId === driver.id);
  const monthTrips = assignedBookings.filter((booking) => isSameMonth(new Date(booking.startDate), TODAY)).length;
  const paidSalary = transactions
    .filter((transaction) => transaction.type === "expense" && transaction.category === "Gaji Sopir" && transaction.description.toLowerCase().includes(driver.name.split(" ")[1]?.toLowerCase() ?? ""))
    .reduce((sum, item) => sum + item.amount, 0);

  const baseSalary = 4200000 + index * 250000;
  const monthlyAllowance = monthTrips * 175000;
  const currentSalary = baseSalary + monthlyAllowance;
  const totalKm = assignedBookings.reduce((sum, booking) => {
    const vehicle = vehicles.find((item) => item.id === booking.vehicleId);
    return sum + Math.round((vehicle?.dailyRate ?? 700000) / 40000) * Number(booking.totalDays || 0) * 38;
  }, 0);

  return {
    ...driver,
    monthTrips,
    currentSalary,
    salaryPaid: paidSalary >= currentSalary * 0.65,
    bankAccount: `BCA 12345${index + 100} a/n ${driver.name}`,
    emergencyContact: `Keluarga ${driver.name.split(" ")[1] ?? "Driver"} • 08${index + 21}7788990${index}`,
    ktp: `3174${String(index + 1).padStart(4, "0")}556600${index + 11}`,
    totalKm,
    totalHours: assignedBookings.reduce((sum, booking) => sum + Number(booking.totalDays || 0) * 11, 0),
    monthlyPayments: [
      {
        month: "Maret 2026",
        amount: baseSalary + 650000,
        status: "Paid",
        date: "2026-03-28",
      },
      {
        month: "April 2026",
        amount: currentSalary,
        status: paidSalary >= currentSalary * 0.65 ? "Paid" : "Pending",
        date: paidSalary >= currentSalary * 0.65 ? "2026-04-24" : "-",
      },
    ],
  };
}

export default function Drivers() {
  const {
    state: { drivers: rawDrivers, bookings, customers, vehicles, transactions },
    dispatch,
  } = useAppContext();
  const [selectedDriverId, setSelectedDriverId] = useState(rawDrivers[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState("profile");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_DRIVER_FORM);

  const enrichedDrivers = useMemo(() => {
    return rawDrivers.map((driver, index) => {
      const baseDriver = normalizeDriver(driver, index, bookings, transactions, vehicles);
      const assignments = bookings
        .filter((booking) => booking.driverId === baseDriver.id)
        .map((booking) => ({
          ...booking,
          customer: customers.find((item) => item.id === booking.customerId),
          vehicle: vehicles.find((item) => item.id === booking.vehicleId),
          review: Number((4.5 + ((booking.totalDays || 1) % 3) * 0.15).toFixed(1)),
        }));

      return {
        ...baseDriver,
        assignments,
        activeAssignment: assignments.find((assignment) => assignment.status === "active") ?? null,
      };
    });
  }, [bookings, customers, rawDrivers, transactions, vehicles]);

  const selectedDriver = enrichedDrivers.find((driver) => driver.id === selectedDriverId) ?? enrichedDrivers[0] ?? null;

  const performanceChart = useMemo(() => {
    return [...enrichedDrivers]
      .sort((a, b) => b.rating - a.rating)
      .map((driver) => ({
        name: driver.name.replace("Pak ", ""),
        rating: driver.rating,
      }));
  }, [enrichedDrivers]);

  const driverAlerts = useMemo(() => {
    return enrichedDrivers.filter((driver) => diffDays(driver.licenseExpiry, TODAY) < 210 || !driver.salaryPaid);
  }, [enrichedDrivers]);

  function payCurrentSalary(driverId) {
    const driver = enrichedDrivers.find((item) => item.id === driverId);
    if (!driver) return;
    dispatch({
      type: "ADD",
      entity: "transactions",
      payload: {
        id: `TRX-DRV-${Date.now()}`,
        type: "expense",
        date: TODAY.toISOString().slice(0, 10),
        category: "Gaji Sopir",
        vehicleId: driver.activeAssignment?.vehicleId ?? "",
        bookingId: driver.activeAssignment?.id ?? "",
        amount: driver.currentSalary,
        description: `Gaji Sopir ${driver.name}`,
        status: "paid",
      },
    });
  }

  function assignDriver(driverId) {
    dispatch({
      type: "UPDATE_STATUS",
      entity: "drivers",
      id: driverId,
      status: "on-duty",
    });
  }

  function addDriver(event) {
    event.preventDefault();
    const nextDriver = normalizeDriver(
      {
        id: `DRV-${String(rawDrivers.length + 1).padStart(3, "0")}`,
        name: formData.name,
        phone: formData.phone,
        license: formData.license,
        licenseExpiry: formData.licenseExpiry,
        experienceYears: 2,
        rating: 4.6,
        status: "available",
        currentBooking: null,
        address: formData.address,
      },
      rawDrivers.length,
      bookings,
      transactions,
      vehicles,
    );

    dispatch({ type: "ADD", entity: "drivers", payload: nextDriver });
    setIsFormOpen(false);
    setFormData(EMPTY_DRIVER_FORM);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <UserRound className="h-4 w-4" />
              Driver operations hub
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Drivers Management</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Pantau performa sopir, riwayat tugas, payroll, dan alert legalitas dalam satu halaman.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-navy"
          >
            <Plus className="h-4 w-4" />
            Tambah Sopir
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {enrichedDrivers.map((driver) => {
              const simDaysLeft = diffDays(driver.licenseExpiry, TODAY);
              const simAlert = simDaysLeft < 30;
              return (
                <article
                  key={driver.id}
                  className={`rounded-[2rem] border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                    selectedDriverId === driver.id ? "border-teal ring-2 ring-teal/20" : "border-slate-200"
                  }`}
                >
                  <button type="button" onClick={() => { setSelectedDriverId(driver.id); setActiveTab("profile"); }} className="w-full text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                          {getDriverInitials(driver.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{driver.name}</p>
                          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${DRIVER_STATUS_META[driver.status].tone}`}>
                            {DRIVER_STATUS_META[driver.status].label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        <Star className="h-3 w-3 fill-current" />
                        {driver.rating}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <StatCard label="Trip bulan ini" value={`${driver.monthTrips}`} />
                      <StatCard label="Gaji berjalan" value={formatRupiah(driver.currentSalary, { compact: true })} />
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-500">SIM expire</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${simAlert ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {simAlert ? `${simDaysLeft} hari lagi` : driver.licenseExpiry}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        Gaji {driver.salaryPaid ? "sudah dibayar" : "belum dibayar"}
                      </p>
                    </div>
                  </button>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <ActionButton onClick={() => { setSelectedDriverId(driver.id); setActiveTab("profile"); }} icon={SearchIcon}>
                      Detail
                    </ActionButton>
                    <ActionButton onClick={() => assignDriver(driver.id)} icon={Car}>
                      Tugaskan
                    </ActionButton>
                    <ActionButton onClick={() => window.open(`https://wa.me/${driver.phone.replace(/^0/, "62")}`, "_blank", "noopener,noreferrer")} icon={Phone}>
                      Hubungi
                    </ActionButton>
                  </div>
                </article>
              );
            })}
          </section>

          {selectedDriver ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                      {getDriverInitials(selectedDriver.name)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{selectedDriver.name}</h3>
                      <p className="text-sm text-slate-500">{selectedDriver.phone} • {selectedDriver.address}</p>
                    </div>
                  </div>
                </div>

                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {DRIVER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        activeTab === tab.key ? "bg-white text-navy shadow-sm" : "text-slate-500"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "profile" ? (
                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard label="Nama Lengkap" value={selectedDriver.name} />
                    <InfoCard label="Nomor HP" value={selectedDriver.phone} />
                    <InfoCard label="Alamat" value={selectedDriver.address} />
                    <InfoCard label="Kontak Darurat" value={selectedDriver.emergencyContact} />
                    <InfoCard label="KTP" value={selectedDriver.ktp} />
                    <InfoCard label="Rekening Bank" value={selectedDriver.bankAccount} />
                    <InfoCard label="SIM" value={`${selectedDriver.license} • ${selectedDriver.licenseExpiry}`} />
                    <InfoCard label="Pengalaman" value={`${selectedDriver.experienceYears} tahun`} />
                  </div>

                  <div className="space-y-4">
                    <DocumentCard title="Foto KTP" placeholder="Preview KTP" />
                    <DocumentCard title="Foto SIM" placeholder="Preview SIM" />
                  </div>
                </div>
              ) : null}

              {activeTab === "history" ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoCard label="Total KM" value={`${formatNumber(selectedDriver.totalKm)} km`} />
                    <InfoCard label="Total Jam Kerja" value={`${formatNumber(selectedDriver.totalHours)} jam`} />
                    <InfoCard label="Rating Rata-rata" value={`${selectedDriver.rating}/5`} />
                  </div>

                  <div className="space-y-4">
                    {selectedDriver.assignments.map((assignment, index) => (
                      <div key={assignment.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                            <Car className="h-4 w-4" />
                          </div>
                          {index !== selectedDriver.assignments.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
                        </div>
                        <div className="pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-slate-900">{assignment.vehicle?.name ?? assignment.vehicleId}</h4>
                            <span className="text-xs text-slate-400">{assignment.startDate} - {assignment.endDate}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            Customer: {assignment.customer?.name ?? "-"} • Review: {assignment.review}/5
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === "payroll" ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoCard label="Gaji Bulan Ini" value={formatRupiah(selectedDriver.currentSalary)} />
                    <InfoCard label="Status" value={selectedDriver.salaryPaid ? "Sudah dibayar" : "Belum dibayar"} />
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Aksi Payroll</p>
                      <button
                        type="button"
                        onClick={() => payCurrentSalary(selectedDriver.id)}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Wallet className="h-4 w-4" />
                        Bayar Gaji Bulan Ini
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          {["Bulan", "Jumlah", "Status", "Tanggal Bayar"].map((head) => (
                            <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDriver.monthlyPayments.map((payment) => (
                          <tr key={payment.month} className="border-t border-slate-200">
                            <td className="px-4 py-3">{payment.month}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(payment.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{payment.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Performance Panel</h3>
                <p className="text-sm text-slate-500">Ranking sopir berdasarkan rating review customer.</p>
              </div>
            </div>
            <div className="mt-5 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceChart} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fill: "#475569", fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="rating" radius={[0, 12, 12, 0]}>
                    {performanceChart.map((entry, index) => (
                      <Cell key={entry.name} fill={index === 0 ? "#0d1f4e" : index === 1 ? "#00b8a9" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Driver Alerts</h3>
                <p className="text-sm text-slate-500">SIM mendekati expire atau payroll belum beres.</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {["Nama", "SIM Expire", "Status Gaji", "Alert"].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {driverAlerts.map((driver) => (
                    <tr key={driver.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900">{driver.name}</td>
                      <td className="px-4 py-3">{driver.licenseExpiry}</td>
                      <td className="px-4 py-3">{driver.salaryPaid ? "Paid" : "Pending"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          diffDays(driver.licenseExpiry, TODAY) < 30 || !driver.salaryPaid
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {diffDays(driver.licenseExpiry, TODAY) < 30 ? "SIM Mau Expire" : !driver.salaryPaid ? "Payroll Pending" : "Clear"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Tambah Sopir</h3>
                <p className="mt-1 text-sm text-slate-500">Isi data legal, kontak, dan payroll dasar sopir baru.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-2xl bg-slate-100 p-2 text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={addDriver} className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <FormField label="Nama" value={formData.name} onChange={(value) => setFormData((current) => ({ ...current, name: value }))} />
              <FormField label="KTP" value={formData.ktp} onChange={(value) => setFormData((current) => ({ ...current, ktp: value }))} />
              <FormField label="SIM" value={formData.license} onChange={(value) => setFormData((current) => ({ ...current, license: value }))} />
              <FormField label="SIM Expire" type="date" value={formData.licenseExpiry} onChange={(value) => setFormData((current) => ({ ...current, licenseExpiry: value }))} />
              <FormField label="Alamat" value={formData.address} onChange={(value) => setFormData((current) => ({ ...current, address: value }))} />
              <FormField label="Kontak" value={formData.phone} onChange={(value) => setFormData((current) => ({ ...current, phone: value }))} />
              <FormField label="Kontak Darurat" value={formData.emergencyContact} onChange={(value) => setFormData((current) => ({ ...current, emergencyContact: value }))} />
              <FormField label="Rekening Bank" value={formData.bankAccount} onChange={(value) => setFormData((current) => ({ ...current, bankAccount: value }))} />
              <FormField label="Gaji Pokok" value={formData.baseSalary} onChange={(value) => setFormData((current) => ({ ...current, baseSalary: value }))} />
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Upload foto KTP & SIM (placeholder demo)
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 border-t border-slate-200 pt-5">
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
                  <Plus className="h-4 w-4" />
                  Simpan Sopir
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon(props) {
  return <ShieldCheck {...props} />;
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DocumentCard({ title, placeholder }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
        <CreditCard className="h-8 w-8" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{placeholder}</p>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
      />
    </label>
  );
}
