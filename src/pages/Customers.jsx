import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  BarChart3,
  MessageCircle,
  PieChart as PieChartIcon,
  Plus,
  Search,
  Star,
  UserCircle2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TODAY, formatRupiah, isSameMonth } from "../lib/format";
import { useAppContext } from "../context/AppContext";

const TAG_META = {
  VIP: { label: "VIP", icon: "🌟", tone: "bg-amber-100 text-amber-700" },
  Blacklist: { label: "Blacklist", icon: "⚠️", tone: "bg-rose-100 text-rose-700" },
  Regular: { label: "Regular", icon: "🔄", tone: "bg-sky-100 text-sky-700" },
  New: { label: "New", icon: "🆕", tone: "bg-emerald-100 text-emerald-700" },
};

function getCustomerTag(customer, blacklisted) {
  if (blacklisted) return "Blacklist";
  if (customer.totalSpent > 5_000_000) return "VIP";
  if (customer.totalBookings >= 3) return "Regular";
  return "New";
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function createCustomerState(customer, index, bookings, transactions) {
  const customerBookings = bookings.filter((booking) => booking.customerId === customer.id);
  const payments = transactions.filter((transaction) => {
    const booking = bookings.find((item) => item.id === transaction.bookingId);
    return transaction.type === "income" && booking?.customerId === customer.id;
  });
  const lastBooking = customerBookings
    .slice()
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
  const averageDuration = customerBookings.length
    ? Math.round(
        customerBookings.reduce((sum, booking) => sum + Number(booking.totalDays || 0), 0) / customerBookings.length,
      )
    : 0;

  const defaultBlacklist = customer.blacklisted ?? customer.id === "CUST-010";
  return {
    ...customer,
    blacklisted: defaultBlacklist,
    tag: getCustomerTag(customer, defaultBlacklist),
    lastBooking,
    averageDuration,
    payments,
    notes:
      customer.notes ??
      (defaultBlacklist ? ["Menunggu verifikasi pembayaran booking terakhir."] : [`Customer aktif sejak ${customer.joinedAt}.`]),
    ktpPhotoLabel: `KTP ${customer.name}`,
    simPhotoLabel: `SIM ${customer.name}`,
    lastBookingDate: lastBooking?.startDate ?? "-",
    spendTier: customer.totalSpent,
    rowColorIndex: index,
  };
}

export default function Customers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    state: { customers: rawCustomers, bookings, transactions, vehicles },
    dispatch,
  } = useAppContext();
  const [selectedCustomerId, setSelectedCustomerId] = useState(rawCustomers[0]?.id ?? null);
  const [noteDraft, setNoteDraft] = useState("");

  const enrichedCustomers = useMemo(() => {
    return rawCustomers.map((baseCustomer, index) => {
      const customer = createCustomerState(baseCustomer, index, bookings, transactions);
      const bookingHistory = bookings
        .filter((booking) => booking.customerId === customer.id)
        .map((booking) => ({
          ...booking,
          vehicle: vehicles.find((item) => item.id === booking.vehicleId),
        }));

      return {
        ...customer,
        tag: getCustomerTag(customer, customer.blacklisted),
        bookingHistory,
      };
    });
  }, [bookings, rawCustomers, transactions, vehicles]);

  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId) {
      setSelectedCustomerId(customerId);
    }
  }, [searchParams]);

  const selectedCustomer = enrichedCustomers.find((customer) => customer.id === selectedCustomerId) ?? enrichedCustomers[0] ?? null;

  const tagBreakdown = useMemo(() => {
    const colors = {
      VIP: "#f59e0b",
      Blacklist: "#ef4444",
      Regular: "#00b8a9",
      New: "#0d1f4e",
    };
    return Object.keys(TAG_META).map((tag) => ({
      name: tag,
      value: enrichedCustomers.filter((customer) => customer.tag === tag).length,
      color: colors[tag],
    }));
  }, [enrichedCustomers]);

  const topSpenders = useMemo(() => {
    return [...enrichedCustomers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 6)
      .map((customer) => ({
        name: customer.name.split(" ")[0],
        spend: customer.totalSpent,
      }));
  }, [enrichedCustomers]);

  const cohortData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(TODAY.getFullYear(), TODAY.getMonth() - 5 + index, 1);
      const monthLabel = date.toLocaleDateString("id-ID", { month: "short" });
      const newCount = enrichedCustomers.filter((customer) => isSameMonth(new Date(customer.joinedAt), date)).length;
      const returning = bookings
        .filter((booking) => isSameMonth(new Date(booking.startDate), date))
        .reduce((count, booking) => {
          const customer = enrichedCustomers.find((item) => item.id === booking.customerId);
          return customer && customer.totalBookings > 1 ? count + 1 : count;
        }, 0);
      return { month: monthLabel, newCustomers: newCount, returning };
    });
    return months;
  }, [enrichedCustomers]);

  function addNote() {
    if (!selectedCustomer || !noteDraft.trim()) return;
    dispatch({
      type: "UPDATE",
      entity: "customers",
      id: selectedCustomer.id,
      payload: { notes: [noteDraft.trim(), ...(selectedCustomer.notes ?? [])] },
    });
    setNoteDraft("");
  }

  function toggleBlacklist(customerId) {
    const target = enrichedCustomers.find((customer) => customer.id === customerId);
    if (!target) return;
    dispatch({
      type: "UPDATE",
      entity: "customers",
      id: customerId,
      payload: { blacklisted: !target.blacklisted },
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <UserCircle2 className="h-4 w-4" />
              Customer relationship center
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Customers Management</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Kelola database customer, histori booking, tag loyalty, pembayaran, dan catatan internal admin.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.85fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Customer Table</h3>
                <p className="text-sm text-slate-500">Pilih customer untuk membuka panel detail di kanan.</p>
              </div>
              <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  placeholder="Cari customer..."
                  className="h-11 w-full bg-transparent text-sm outline-none"
                />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {["Foto", "Nama", "Nomor HP", "Total Booking", "Total Spend", "Last Booking", "Tag", "Aksi"].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrichedCustomers.map((customer) => {
                    const tagMeta = TAG_META[customer.tag];
                    return (
                      <tr key={customer.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                            {getInitials(customer.name)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{customer.name}</td>
                        <td className="px-4 py-3">{customer.phone}</td>
                        <td className="px-4 py-3">{customer.totalBookings}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(customer.totalSpent)}</td>
                        <td className="px-4 py-3">{customer.lastBookingDate}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tagMeta.tone}`}>
                            {tagMeta.icon} {tagMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton onClick={() => setSelectedCustomerId(customer.id)} icon={Star}>
                              Detail
                            </ActionButton>
                            <ActionButton
                              onClick={() => window.open(`https://wa.me/${customer.phone.replace(/^0/, "62")}`, "_blank", "noopener,noreferrer")}
                              icon={MessageCircle}
                            >
                              Kirim WA
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-slate-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Customer Analytics</h3>
                <p className="text-sm text-slate-500">Komposisi tag, top spenders, dan cohort customer.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <h4 className="font-semibold text-slate-900">Komposisi Tag Customer</h4>
                <div className="mt-4 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie data={tagBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                        {tagBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <h4 className="font-semibold text-slate-900">Customer Terbaik by Spend</h4>
                <div className="mt-4 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSpenders} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={82} />
                      <Tooltip formatter={(value) => formatRupiah(value)} />
                      <Bar dataKey="spend" radius={[0, 12, 12, 0]}>
                        {topSpenders.map((entry, index) => (
                          <Cell key={entry.name} fill={index === 0 ? "#0d1f4e" : index === 1 ? "#00b8a9" : "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">Cohort Customer Baru vs Returning</h4>
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="newCustomers" fill="#00b8a9" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="returning" fill="#0d1f4e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>

        {selectedCustomer ? (
          <aside className="sticky top-24 h-fit rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {getInitials(selectedCustomer.name)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedCustomer.phone}</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${TAG_META[selectedCustomer.tag].tone}`}>
                  {TAG_META[selectedCustomer.tag].icon} {TAG_META[selectedCustomer.tag].label}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <InfoCard label="Total Booking" value={`${selectedCustomer.totalBookings} booking`} />
              <InfoCard label="Total Spend" value={formatRupiah(selectedCustomer.totalSpent)} />
              <InfoCard label="Rata-rata Durasi" value={`${selectedCustomer.averageDuration} hari`} />
              <InfoCard label="Last Booking" value={selectedCustomer.lastBookingDate} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <DocumentCard title="Foto KTP" placeholder={selectedCustomer.ktpPhotoLabel} />
              <DocumentCard title="Foto SIM" placeholder={selectedCustomer.simPhotoLabel} />
            </div>

            <section className="mt-6">
              <h4 className="font-semibold text-slate-900">Riwayat Booking</h4>
              <div className="mt-3 overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {["Booking", "Kendaraan", "Periode", "Total"].map((head) => (
                        <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomer.bookingHistory.map((booking) => (
                      <tr key={booking.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{booking.id}</td>
                        <td className="px-4 py-3">{booking.vehicle?.name ?? "-"}</td>
                        <td className="px-4 py-3">{booking.startDate} - {booking.endDate}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(booking.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6">
              <h4 className="font-semibold text-slate-900">Riwayat Pembayaran</h4>
              <div className="mt-3 space-y-3">
                {selectedCustomer.payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="font-medium text-slate-900">{payment.description}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-slate-500">
                      <span>{payment.date}</span>
                      <span className="font-semibold text-emerald-600">{formatRupiah(payment.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h4 className="font-semibold text-slate-900">Catatan Internal</h4>
              <div className="mt-3 space-y-3">
                {selectedCustomer.notes.map((note, index) => (
                  <div key={`${selectedCustomer.id}-${index}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    {note}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Tambah catatan admin..."
                  className="h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={addNote}
                  className="inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Tambah
                </button>
              </div>
            </section>

            <div className="mt-6 flex flex-wrap gap-2">
              <ActionButton
                onClick={() => navigate("/bookings", { state: { openNewBooking: true, customerId: selectedCustomer.id } })}
                icon={Plus}
              >
                Booking Baru
              </ActionButton>
              <ActionButton onClick={() => window.open(`https://wa.me/${selectedCustomer.phone.replace(/^0/, "62")}`, "_blank", "noopener,noreferrer")} icon={MessageCircle}>Kirim WA</ActionButton>
              <ActionButton onClick={() => toggleBlacklist(selectedCustomer.id)} icon={Ban}>
                {selectedCustomer.blacklisted ? "Unblacklist" : "Blacklist"}
              </ActionButton>
            </div>
          </aside>
        ) : null}
      </section>
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
        <UserCircle2 className="h-8 w-8" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{placeholder}</p>
    </div>
  );
}
