import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BellRing,
  CalendarClock,
  Car,
  CheckCircle2,
  Clock3,
  Crown,
  DollarSign,
  FileWarning,
  Fuel,
  ReceiptText,
  Settings,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TODAY,
  addDays,
  addMonths,
  dateInRange,
  diffDays,
  formatNumber,
  formatRupiah,
  isSameMonth,
  startOfDay,
} from "../lib/format";
import { useCounter } from "../hooks/useCounter";
import { useAppContext } from "../context/AppContext";
import { PageSkeleton } from "../components/ui/Skeleton";

const STATUS_META = {
  available: {
    label: "Tersedia",
    className: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  rented: {
    label: "Disewa",
    className: "bg-rose-100 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
  maintenance: {
    label: "Servis",
    className: "bg-amber-100 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
};

const CARD_STYLES = {
  navy: "from-navy to-slate-900 text-white",
  teal: "from-teal to-cyan-700 text-white",
  green: "from-emerald-500 to-green-700 text-white",
  orange: "from-orange-400 to-orange-600 text-white",
  red: "from-rose-500 to-red-700 text-white",
};

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatDateLabel(date) {
  const day = DAY_LABELS[date.getDay()];
  return `${day}, ${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(date) {
  return `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

function getTrend(current, previous) {
  if (!previous && !current) {
    return { direction: "up", percentage: 0, label: "Stabil vs bulan lalu" };
  }
  if (!previous && current) {
    return { direction: "up", percentage: 100, label: "Naik dari basis nol" };
  }

  const delta = current - previous;
  const percentage = Math.round((Math.abs(delta) / Math.max(Math.abs(previous), 1)) * 100);

  return {
    direction: delta >= 0 ? "up" : "down",
    percentage,
    label: `${delta >= 0 ? "Naik" : "Turun"} ${percentage}% vs bulan lalu`,
  };
}

function CounterValue({ value, currency = false, compact = false }) {
  const animated = useCounter(value);
  const displayValue = currency
    ? formatRupiah(Math.round(animated), { compact })
    : formatNumber(Math.round(animated));

  return (
    <span className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
      {displayValue}
    </span>
  );
}

function MetricCard({ title, value, icon: Icon, tone, trend, onClick, currency = false }) {
  const TrendIcon = trend.direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left shadow-lg shadow-slate-200/70 transition duration-200 hover:-translate-y-1 ${CARD_STYLES[tone]}`}
    >
      <div className="absolute inset-0 bg-white/5 opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-white/80">{title}</p>
          <CounterValue value={value} currency={currency} />
        </div>
        <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3 text-sm">
        <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-white">
          <TrendIcon className="h-4 w-4" />
          <span>{trend.label}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-white/80 transition group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    state: { vehicles, customers, bookings, transactions, maintenance },
  } = useAppContext();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const dashboardData = useMemo(() => {
    const today = startOfDay(TODAY);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const vehicleById = Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const customerById = Object.fromEntries(customers.map((customer) => [customer.id, customer]));

    const incomeTransactions = transactions.filter((item) => item.type === "income");
    const expenseTransactions = transactions.filter((item) => item.type === "expense");

    const incomeToday = incomeTransactions
      .filter((item) => startOfDay(item.date).getTime() === today.getTime())
      .reduce((sum, item) => sum + item.amount, 0);

    const incomeMonth = incomeTransactions
      .filter((item) => isSameMonth(startOfDay(item.date), today))
      .reduce((sum, item) => sum + item.amount, 0);

    const incomePrevMonth = incomeTransactions
      .filter((item) => isSameMonth(startOfDay(item.date), previousMonthStart))
      .reduce((sum, item) => sum + item.amount, 0);

    const incomeTodayPreviousWindow = incomeTransactions
      .filter((item) => {
        const date = startOfDay(item.date);
        return date >= addDays(today, -1) && date < today;
      })
      .reduce((sum, item) => sum + item.amount, 0);

    const unpaidBills = bookings
      .filter((booking) => booking.paymentStatus !== "paid")
      .reduce((sum, booking) => sum + booking.total, 0);

    const previousUnpaidBills = bookings
      .filter((booking) => {
        const bookingDate = startOfDay(booking.startDate);
        return booking.paymentStatus !== "paid" && bookingDate < currentMonthStart;
      })
      .reduce((sum, booking) => sum + booking.total, 0);

    const rentedVehicles = vehicles.filter((vehicle) => vehicle.status === "rented").length;
    const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "available").length;
    const maintenanceVehicles = vehicles.filter((vehicle) => vehicle.status === "maintenance").length;

    const currentMonthBookings = bookings.filter((booking) =>
      isSameMonth(startOfDay(booking.startDate), today),
    );
    const previousMonthBookings = bookings.filter((booking) =>
      isSameMonth(startOfDay(booking.startDate), previousMonthStart),
    );

    const metricCards = [
      {
        key: "total-armada",
        title: "Total Armada",
        value: vehicles.length,
        icon: Car,
        tone: "navy",
        trend: getTrend(vehicles.length, Math.max(vehicles.length - 1, 0)),
        path: "/fleet",
      },
      {
        key: "sedang-disewa",
        title: "Sedang Disewa",
        value: rentedVehicles,
        icon: CalendarClock,
        tone: "teal",
        trend: getTrend(
          currentMonthBookings.filter((booking) => booking.status === "active").length,
          previousMonthBookings.filter((booking) => booking.status === "active").length,
        ),
        path: "/fleet?status=rented",
      },
      {
        key: "tersedia",
        title: "Tersedia di Garasi",
        value: availableVehicles,
        icon: CheckCircle2,
        tone: "green",
        trend: getTrend(
          availableVehicles,
          vehicles.filter((vehicle) => vehicle.status !== "rented").length,
        ),
        path: "/fleet",
      },
      {
        key: "servis",
        title: "Dalam Servis",
        value: maintenanceVehicles,
        icon: Wrench,
        tone: "orange",
        trend: getTrend(
          maintenance.filter((item) => item.status === "in-progress").length,
          maintenance.filter(
            (item) =>
              item.status === "in-progress" && isSameMonth(addMonths(today, -1), startOfDay(item.date)),
          ).length,
        ),
        path: "/maintenance",
      },
      {
        key: "today-income",
        title: "Pendapatan Hari Ini",
        value: incomeToday,
        icon: Banknote,
        tone: "teal",
        trend: getTrend(incomeToday, incomeTodayPreviousWindow),
        path: "/finance",
        currency: true,
      },
      {
        key: "month-income",
        title: "Pendapatan Bulan Ini",
        value: incomeMonth,
        icon: DollarSign,
        tone: "navy",
        trend: getTrend(incomeMonth, incomePrevMonth),
        path: "/finance",
        currency: true,
      },
      {
        key: "unpaid",
        title: "Tagihan Belum Bayar",
        value: unpaidBills,
        icon: ReceiptText,
        tone: "red",
        trend: getTrend(unpaidBills, previousUnpaidBills),
        path: "/invoice",
        currency: true,
      },
      {
        key: "customers",
        title: "Total Pelanggan",
        value: customers.length,
        icon: Users,
        tone: "green",
        trend: getTrend(
          customers.filter((customer) => isSameMonth(startOfDay(customer.joinedAt), today)).length,
          customers.filter((customer) => isSameMonth(startOfDay(customer.joinedAt), previousMonthStart)).length,
        ),
        path: "/customers",
      },
    ];

    const revenueChart = Array.from({ length: 6 }, (_, index) => {
      const monthDate = addMonths(currentMonthStart, index - 5);
      const revenue = incomeTransactions
        .filter((item) => isSameMonth(startOfDay(item.date), monthDate))
        .reduce((sum, item) => sum + item.amount, 0);
      const expense = expenseTransactions
        .filter((item) => isSameMonth(startOfDay(item.date), monthDate))
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        month: formatMonthLabel(monthDate),
        revenue,
        target: Math.round(revenue * 1.12) || 10000000,
        expense,
      };
    });

    const nextSevenDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));

    const availabilityGrid = vehicles.map((vehicle) => {
      const vehicleMaintenance = maintenance.find(
        (item) => item.vehicleId === vehicle.id && item.status === "in-progress",
      );

      const days = nextSevenDays.map((date) => {
        const activeBooking = bookings.find(
          (booking) =>
            booking.vehicleId === vehicle.id &&
            ["active", "upcoming"].includes(booking.status) &&
            dateInRange(date, booking.startDate, booking.endDate),
        );

        if (vehicleMaintenance && date >= today) {
          return {
            date,
            status: "maintenance",
            booking: null,
            maintenance: vehicleMaintenance,
          };
        }

        if (activeBooking) {
          return {
            date,
            status: "rented",
            booking: activeBooking,
            maintenance: null,
          };
        }

        return {
          date,
          status: "available",
          booking: null,
          maintenance: null,
        };
      });

      return { vehicle, days };
    });

    const lateVehicles = bookings
      .filter((booking) => booking.status === "active" && diffDays(today, booking.endDate) > 0)
      .map((booking) => ({
        id: `late-${booking.id}`,
        level: "critical",
        title: "Kendaraan terlambat kembali",
        description: `${vehicleById[booking.vehicleId]?.name ?? booking.vehicleId} terlambat ${diffDays(
          today,
          booking.endDate,
        )} hari dari booking ${booking.id}.`,
        path: `/bookings?bookingId=${booking.id}`,
        icon: ShieldAlert,
      }));

    const contractWarnings = bookings
      .filter((booking) => booking.status === "active" && diffDays(booking.endDate, today) === 1)
      .map((booking) => ({
        id: `contract-${booking.id}`,
        level: "warning",
        title: "Kontrak habis H-1",
        description: `${customerById[booking.customerId]?.name ?? booking.customerId} akan selesai besok untuk ${
          vehicleById[booking.vehicleId]?.name ?? booking.vehicleId
        }.`,
        path: `/bookings?bookingId=${booking.id}`,
        icon: AlertTriangle,
      }));

    const stnkWarnings = vehicles
      .filter((vehicle) => diffDays(vehicle.nextService, today) <= 35)
      .map((vehicle) => ({
        id: `service-${vehicle.id}`,
        level: "warning",
        title: "STNK / servis mendekati jatuh tempo",
        description: `${vehicle.name} perlu perhatian dalam ${Math.max(
          diffDays(vehicle.nextService, today),
          0,
        )} hari.`,
        path: `/maintenance?vehicleId=${vehicle.id}`,
        icon: FileWarning,
      }));

    const newBookingAlerts = bookings
      .filter((booking) => diffDays(today, booking.startDate) <= 7 && booking.status === "upcoming")
      .slice(0, 2)
      .map((booking) => ({
        id: `new-${booking.id}`,
        level: "info",
        title: "Booking baru masuk",
        description: `${customerById[booking.customerId]?.name ?? booking.customerId} memesan ${
          vehicleById[booking.vehicleId]?.name ?? booking.vehicleId
        } mulai ${formatDateLabel(startOfDay(booking.startDate))}.`,
        path: `/bookings?bookingId=${booking.id}`,
        icon: BellRing,
      }));

    const alerts = [...lateVehicles, ...contractWarnings, ...stnkWarnings.slice(0, 2), ...newBookingAlerts].slice(
      0,
      6,
    );

    const recentActivity = [
      ...bookings.map((booking) => ({
        id: `booking-${booking.id}`,
        date: startOfDay(booking.startDate),
        title: `Booking ${booking.id}`,
        description: `${customerById[booking.customerId]?.name ?? booking.customerId} reservasi ${
          vehicleById[booking.vehicleId]?.name ?? booking.vehicleId
        } (${booking.status}).`,
        type: "booking",
      })),
      ...transactions.map((transaction) => ({
        id: `trx-${transaction.id}`,
        date: startOfDay(transaction.date),
        title: transaction.type === "income" ? "Pembayaran masuk" : "Pengeluaran tercatat",
        description: `${transaction.description} senilai ${formatRupiah(transaction.amount, {
          compact: true,
        })}.`,
        type: transaction.type,
      })),
      ...maintenance.map((item) => ({
        id: `mnt-${item.id}`,
        date: startOfDay(item.date),
        title: `Maintenance ${item.type}`,
        description: `${vehicleById[item.vehicleId]?.name ?? item.vehicleId} di ${item.vendor} (${item.status}).`,
        type: "maintenance",
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);

    const bookingFrequency = bookings.reduce((acc, booking) => {
      acc[booking.vehicleId] = (acc[booking.vehicleId] ?? 0) + 1;
      return acc;
    }, {});

    const revenueByVehicle = Object.values(
      bookings.reduce((acc, booking) => {
        const vehicle = vehicleById[booking.vehicleId];
        if (!vehicle) return acc;
        if (!acc[booking.vehicleId]) {
          acc[booking.vehicleId] = {
            vehicleId: booking.vehicleId,
            name: vehicle.type,
            fullName: vehicle.name,
            revenue: 0,
          };
        }
        acc[booking.vehicleId].revenue += booking.total;
        return acc;
      }, {}),
    )
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topVehicle = Object.entries(bookingFrequency)
      .sort(([, a], [, b]) => b - a)[0];

    const topCustomer = [...customers].sort((a, b) => b.totalBookings - a.totalBookings)[0];

    return {
      metricCards,
      revenueChart,
      availabilityGrid,
      alerts,
      recentActivity,
      topVehicle: topVehicle
        ? {
            name: vehicleById[topVehicle[0]]?.name ?? topVehicle[0],
            value: topVehicle[1],
          }
        : null,
      topCustomer,
      revenueByVehicle,
    };
  }, []);

  if (loading) {
    return <PageSkeleton cards={8} />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <Clock3 className="h-4 w-4" />
              Command center operasional 25 April 2026
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Ringkasan real-time armada, booking, dan revenue Choky Rental.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base">
              Semua kalkulasi ditarik langsung dari `db.json` dan dirangkum untuk memudahkan keputusan harian.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-white/70">Booking aktif</p>
              <p className="mt-2 text-2xl font-bold">
                {formatNumber(bookings.filter((booking) => booking.status === "active").length)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-white/70">Pool siap jalan</p>
              <p className="mt-2 text-2xl font-bold">
                {formatNumber(vehicles.filter((vehicle) => vehicle.status === "available").length)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm col-span-2 sm:col-span-1">
              <p className="text-sm text-white/70">Alert aktif</p>
              <p className="mt-2 text-2xl font-bold">{formatNumber(dashboardData.alerts.length)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardData.metricCards.map((card) => (
          <MetricCard
            key={card.key}
            title={card.title}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            trend={card.trend}
            currency={card.currency}
            onClick={() => navigate(card.path)}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
        <SectionCard
          title="Revenue 6 Bulan Terakhir"
          subtitle="Target ditampilkan sebagai garis, realisasi revenue ditampilkan sebagai batang."
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dashboardData.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => formatRupiah(value, { compact: true })}
                />
                <Tooltip
                  formatter={(value) => formatRupiah(value)}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                  }}
                />
                <Bar dataKey="revenue" fill="#00b8a9" radius={[10, 10, 0, 0]} barSize={36} />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#0d1f4e"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#0d1f4e" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Alert Panel"
          subtitle="Notifikasi prioritas yang perlu tindakan cepat."
          action={
            <button
              type="button"
              onClick={() => navigate("/analytics")}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Lihat semua
            </button>
          }
        >
          <div className="space-y-3">
            {dashboardData.alerts.map((alert) => {
              const tone =
                alert.level === "critical"
                  ? "border-rose-200 bg-rose-50"
                  : alert.level === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50";

              const badge =
                alert.level === "critical"
                  ? "bg-rose-600 text-white"
                  : alert.level === "warning"
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white";

              const levelLabel =
                alert.level === "critical"
                  ? "CRITICAL"
                  : alert.level === "warning"
                    ? "WARNING"
                    : "INFO";

              const Icon = alert.icon;

              return (
                <div key={alert.id} className={`rounded-2xl border p-4 ${tone}`}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-2 shadow-sm">
                      <Icon className="h-5 w-5 text-slate-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge}`}>
                          {levelLabel}
                        </span>
                        <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{alert.description}</p>
                      <button
                        type="button"
                        onClick={() => navigate(alert.path)}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"
                      >
                        Tangani
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Kalender Availability Mini"
        subtitle="Klik sel untuk melihat detail booking, servis, atau status ketersediaan kendaraan."
      >
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[240px_repeat(7,minmax(0,1fr))] gap-2">
              <div className="px-4 py-3 text-sm font-semibold text-slate-500">Kendaraan</div>
              {Array.from({ length: 7 }, (_, index) => addDays(TODAY, index)).map((date) => (
                <div
                  key={date.toISOString()}
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  {formatDateLabel(date)}
                </div>
              ))}

              {dashboardData.availabilityGrid.map((row) => (
                <FragmentRow
                  key={row.vehicle.id}
                  row={row}
                  onSelect={(payload) => setSelectedSlot(payload)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <LegendDot color="bg-emerald-500" label="Tersedia" />
          <LegendDot color="bg-rose-500" label="Disewa" />
          <LegendDot color="bg-amber-500" label="Servis" />
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <SectionCard title="Recent Activity" subtitle="Timeline aktivitas operasional terbaru.">
          <div className="space-y-4">
            {dashboardData.recentActivity.map((item, index) => {
              const icon =
                item.type === "booking"
                  ? CalendarClock
                  : item.type === "income"
                    ? Banknote
                    : item.type === "expense"
                      ? Fuel
                      : Settings;
              const Icon = icon;

              return (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="rounded-2xl bg-slate-100 p-2">
                      <Icon className="h-4 w-4 text-slate-700" />
                    </div>
                    {index !== dashboardData.recentActivity.length - 1 ? (
                      <div className="mt-2 h-full w-px bg-slate-200" />
                    ) : null}
                  </div>
                  <div className="pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <span className="text-xs text-slate-400">{formatDateLabel(item.date)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Top Stats Row" subtitle="Sorotan performa armada dan pelanggan teratas.">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Kendaraan paling sering disewa</p>
                  <h3 className="mt-1 font-semibold text-slate-900">
                    {dashboardData.topVehicle?.name ?? "Belum ada data"}
                  </h3>
                </div>
                <div className="rounded-2xl bg-teal/10 p-2 text-teal">
                  <Car className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {formatNumber(dashboardData.topVehicle?.value ?? 0)} booking
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Customer paling loyal</p>
                  <h3 className="mt-1 font-semibold text-slate-900">
                    {dashboardData.topCustomer?.name ?? "Belum ada data"}
                  </h3>
                </div>
                <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                  <Crown className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {formatNumber(dashboardData.topCustomer?.totalBookings ?? 0)} booking
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Total belanja {formatRupiah(dashboardData.topCustomer?.totalSpent ?? 0, { compact: true })}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Revenue per kendaraan</p>
                  <h3 className="mt-1 font-semibold text-slate-900">Top 5 kontribusi armada</h3>
                </div>
                <div className="rounded-2xl bg-navy/10 p-2 text-navy">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboardData.revenueByVehicle}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={72}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => formatRupiah(value)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? "Armada"}
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                      }}
                    />
                    <Bar dataKey="revenue" radius={[0, 12, 12, 0]}>
                      {dashboardData.revenueByVehicle.map((entry, index) => (
                        <Cell
                          key={entry.vehicleId}
                          fill={index === 0 ? "#0d1f4e" : index === 1 ? "#00b8a9" : "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      {selectedSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{formatDateLabel(selectedSlot.date)}</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedSlot.vehicle.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <div className="mt-5">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                  STATUS_META[selectedSlot.status].className
                }`}
              >
                {STATUS_META[selectedSlot.status].label}
              </span>
            </div>

            {selectedSlot.booking ? (
              <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                <InfoRow label="Booking" value={selectedSlot.booking.id} />
                <InfoRow
                  label="Pelanggan"
                  value={customers.find((item) => item.id === selectedSlot.booking.customerId)?.name ?? "-"}
                />
                <InfoRow label="Periode" value={`${selectedSlot.booking.startDate} s/d ${selectedSlot.booking.endDate}`} />
                <InfoRow label="Status bayar" value={selectedSlot.booking.paymentStatus} />
                <InfoRow label="Nilai" value={formatRupiah(selectedSlot.booking.total)} />
              </div>
            ) : null}

            {selectedSlot.maintenance ? (
              <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                <InfoRow label="Maintenance" value={selectedSlot.maintenance.type} />
                <InfoRow label="Vendor" value={selectedSlot.maintenance.vendor} />
                <InfoRow label="Tanggal" value={selectedSlot.maintenance.date} />
                <InfoRow label="Biaya" value={formatRupiah(selectedSlot.maintenance.cost)} />
              </div>
            ) : null}

            {!selectedSlot.booking && !selectedSlot.maintenance ? (
              <div className="mt-5 rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-700">
                Armada siap digunakan dan belum ada booking pada tanggal ini.
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    selectedSlot.status === "maintenance"
                      ? "/maintenance"
                      : selectedSlot.status === "rented"
                        ? "/bookings"
                        : "/fleet",
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
              >
                Buka halaman terkait
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FragmentRow({ row, onSelect }) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="font-semibold text-slate-900">{row.vehicle.type}</p>
        <p className="mt-0.5 text-sm text-slate-500">{row.vehicle.plate}</p>
      </div>
      {row.days.map((slot) => (
        <button
          key={`${row.vehicle.id}-${slot.date.toISOString()}`}
          type="button"
          onClick={() => onSelect({ ...slot, vehicle: row.vehicle })}
          className={`rounded-2xl border px-3 py-3 text-left transition hover:scale-[1.02] ${
            slot.status === "available"
              ? "border-emerald-200 bg-emerald-100"
              : slot.status === "rented"
                ? "border-rose-200 bg-rose-100"
                : "border-amber-200 bg-amber-100"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[slot.status].dot}`} />
            <span className="text-xs font-semibold text-slate-700">{STATUS_META[slot.status].label}</span>
          </div>
          <p className="mt-3 line-clamp-2 text-xs text-slate-600">
            {slot.booking?.id ?? slot.maintenance?.type ?? "Tidak ada agenda"}
          </p>
        </button>
      ))}
    </>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
