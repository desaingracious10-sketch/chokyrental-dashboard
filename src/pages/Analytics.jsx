import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Car,
  Download,
  LineChart as LineChartIcon,
  LoaderCircle,
  Send,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TODAY, addMonths, diffDays, formatRupiah, isSameMonth } from "../lib/format";
import { useAppContext } from "../context/AppContext";

const QUICK_CHIPS = [
  "laporan bulan ini",
  "fleet status",
  "cash flow",
  "alert aktif",
  "performa terbaik",
];

const REPORTS = [
  "Laporan Keuangan Bulanan (PDF)",
  "Rekap Booking Bulanan",
  "Performance Kendaraan",
  "Rekap Penggajian Sopir",
];

function monthLabel(date) {
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(new Date(date));
}

function buildAssistantResponse(query, context) {
  const q = query.toLowerCase();
  if (q.includes("laporan") || q.includes("bulan ini")) {
    return `Bulan April 2026: Revenue ${formatRupiah(context.monthRevenue)}, expense ${formatRupiah(
      context.monthExpense,
    )}, profit ${formatRupiah(context.monthProfit)}. Kendaraan paling profitable: ${
      context.bestVehicle
    }. ${context.overdueCount} invoice belum dibayar total ${formatRupiah(context.outstanding)}.`;
  }

  if (q.includes("fleet") || q.includes("status")) {
    return `Saat ini: ${context.availableCount} kendaraan tersedia, ${context.rentedCount} sedang disewa, ${context.maintenanceCount} dalam servis. Alert utama: ${context.overdueVehicle}.`;
  }

  if (q.includes("cash") || q.includes("flow")) {
    return `Cash flow bulan ini menunjukkan pemasukan ${formatRupiah(context.monthRevenue)} dan pengeluaran ${formatRupiah(
      context.monthExpense,
    )}. Posisi arus kas bersih saat ini ${formatRupiah(context.monthProfit)}.`;
  }

  if (q.includes("belum bayar") || q.includes("invoice") || q.includes("overdue")) {
    return `Ada ${context.overdueCount} invoice overdue: ${context.overdueSummary}. Total outstanding ${formatRupiah(
      context.outstanding,
    )}.`;
  }

  if (q.includes("jual") || q.includes("roi") || q.includes("kendaraan mana")) {
    return `Analisis AI: ${context.worstVehicle} memiliki utilization rate ${context.worstVehicleUtilization}% dengan biaya maintenance ${formatRupiah(
      context.worstVehicleMaintenance,
    )}. ROI cenderung negatif. Rekomendasi: pertimbangkan reposisi harga atau jual unit jika tren 3 bulan tidak membaik.`;
  }

  if (q.includes("performa terbaik") || q.includes("terbaik")) {
    return `Performa terbaik saat ini adalah ${context.bestVehicle} dengan profit bersih tertinggi ${formatRupiah(
      context.bestVehicleProfit,
    )} dan utilization ${context.bestVehicleUtilization}%.`;
  }

  if (q.includes("alert")) {
    return `Alert aktif hari ini: ${context.overdueVehicle}, ${context.serviceAlertVehicle}, dan ${context.outstandingCustomer}. Prioritas tindakan ada di booking overdue, jadwal servis, dan follow-up invoice.`;
  }

  return "Saya bisa bantu jawab soal laporan bulan ini, fleet status, cash flow, overdue invoice, performa terbaik, atau rekomendasi kendaraan yang perlu dievaluasi.";
}

export default function Analytics() {
  const {
    state: { vehicles, customers, bookings, transactions, maintenance, invoices },
  } = useAppContext();
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Halo, saya Choky AI Assistant. Tanya soal laporan bulan ini, fleet status, cash flow, atau alert aktif.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [reportModal, setReportModal] = useState(null);

  const analytics = useMemo(() => {
    const monthRevenue = transactions
      .filter((item) => item.type === "income" && isSameMonth(new Date(item.date), TODAY))
      .reduce((sum, item) => sum + item.amount, 0);
    const monthExpense = transactions
      .filter((item) => item.type === "expense" && isSameMonth(new Date(item.date), TODAY))
      .reduce((sum, item) => sum + item.amount, 0);
    const monthProfit = monthRevenue - monthExpense;

    const occupancyRate = Math.round(
      (bookings.filter((booking) => isSameMonth(new Date(booking.startDate), TODAY)).reduce(
        (sum, booking) => sum + Number(booking.totalDays || 0),
        0,
      ) /
        (vehicles.length * new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate())) *
        100,
    );

    const averageRevenuePerUnit = Math.round(monthRevenue / Math.max(vehicles.length, 1));
    const customerLifetimeValue = Math.round(
      customers.reduce((sum, customer) => sum + customer.totalSpent, 0) / Math.max(customers.length, 1),
    );
    const costPerAcquisition = Math.round(monthExpense * 0.18 / Math.max(customers.filter((c) => isSameMonth(new Date(c.joinedAt), TODAY)).length || 1, 1));

    const revenueHistory = Array.from({ length: 9 }, (_, index) => {
      const date = addMonths(TODAY, index - 5);
      const realRevenue = transactions
        .filter((item) => item.type === "income" && isSameMonth(new Date(item.date), date))
        .reduce((sum, item) => sum + item.amount, 0);
      return {
        month: monthLabel(date),
        revenue: index < 6 ? realRevenue : null,
        prediction:
          index < 6
            ? null
            : Math.round(
                (transactions
                  .filter((item) => item.type === "income" && isSameMonth(new Date(item.date), addMonths(date, -1)))
                  .reduce((sum, item) => sum + item.amount, 0) +
                  monthRevenue * 0.92 +
                  index * 350000) /
                  2,
              ),
      };
    });

    const utilizationData = vehicles.map((vehicle) => {
      const days = bookings
        .filter((booking) => booking.vehicleId === vehicle.id && isSameMonth(new Date(booking.startDate), TODAY))
        .reduce((sum, booking) => sum + Number(booking.totalDays || 0), 0);
      const utilization = Math.round(
        (days / Math.max(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate(), 1)) * 100,
      );
      return {
        name: vehicle.type,
        fullName: vehicle.name,
        utilization,
        color: utilization < 50 ? "#ef4444" : utilization < 70 ? "#f59e0b" : "#10b981",
      };
    });

    const segmentation = customers.map((customer) => {
      const daysSinceJoin = Math.max(diffDays(TODAY, customer.joinedAt), 1);
      const recencyGap =
        bookings
          .filter((booking) => booking.customerId === customer.id)
          .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0]?.startDate ?? customer.joinedAt;
      const daysSinceBooking = Math.max(diffDays(TODAY, recencyGap), 0);
      let segment = "Regular";
      let action = "Pertahankan engagement";
      if (customer.totalSpent > 15000000) {
        segment = "VIP";
        action = "Prioritaskan upsell paket premium";
      } else if (customer.totalBookings <= 1 && daysSinceJoin < 120) {
        segment = "New";
        action = "Kirim welcome offer";
      } else if (daysSinceBooking > 180) {
        segment = "Churned";
        action = "Retarget dengan promo win-back";
      } else if (daysSinceBooking > 90) {
        segment = "At-Risk";
        action = "Lakukan follow-up personal";
      }
      return {
        name: customer.name.split(" ")[0],
        spend: customer.totalSpent,
        bookings: customer.totalBookings,
        segment,
        action,
      };
    });

    const profitability = vehicles
      .map((vehicle) => {
        const revenue = bookings.filter((booking) => booking.vehicleId === vehicle.id).reduce((sum, booking) => sum + booking.total, 0);
        const maintenanceCost = maintenance
          .filter((item) => item.vehicleId === vehicle.id)
          .reduce((sum, item) => sum + item.cost, 0);
        const otherCost = revenue * 0.12;
        const net = revenue - maintenanceCost - otherCost;
        return {
          name: vehicle.type,
          fullName: vehicle.name,
          revenue,
          maintenanceCost,
          otherCost,
          net,
        };
      })
      .sort((a, b) => b.net - a.net);

    const overdueInvoices = invoices.filter((invoice) => invoice.balanceDue > 0 && diffDays(TODAY, invoice.dueDate) > 7);
    const overdueCount = overdueInvoices.length;
    const outstanding = overdueInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
    const overdueSummary = overdueInvoices
      .slice(0, 2)
      .map(
        (invoice, index) =>
          `${index + 1}. ${invoice.customer?.name ?? invoice.customerId} - ${formatRupiah(invoice.balanceDue)}`,
      )
      .join(" ");

    const lateBooking = bookings.find((booking) => booking.status === "active" && diffDays(TODAY, booking.endDate) > 0);

    const anomalyList = [
      {
        title: "Kendaraan konsumsi BBM lebih tinggi dari biasanya",
        description: "Toyota Hiace Premio 2022 tercatat biaya BBM dan tol 28% lebih tinggi dibanding rata-rata trip serupa.",
        action: "Audit rute perjalanan dan cek efisiensi mesin di bengkel.",
      },
      {
        title: "Pengeluaran kategori servis naik 40% dari bulan lalu",
        description: "Biaya servis April 2026 naik tajam karena dua unit masuk bengkel besar dan penggantian part utama.",
        action: "Susun preventive maintenance plan agar kerusakan besar berkurang.",
      },
      {
        title: "Customer belum bayar 2x berturut-turut",
        description: "Indah Permatasari memiliki booking unpaid dan histori konfirmasi pembayaran terlambat.",
        action: "Terapkan aturan DP wajib sebelum unit diblok untuk customer ini.",
      },
    ];

    return {
      monthRevenue,
      monthExpense,
      monthProfit,
      occupancyRate,
      averageRevenuePerUnit,
      customerLifetimeValue,
      costPerAcquisition,
      revenueHistory,
      utilizationData,
      segmentation,
      profitability,
      overdueCount,
      outstanding,
      overdueSummary,
      bestVehicle: profitability[0]?.fullName ?? "-",
      bestVehicleProfit: profitability[0]?.net ?? 0,
      bestVehicleUtilization:
        utilizationData.find((item) => item.fullName === profitability[0]?.fullName)?.utilization ?? 0,
      worstVehicle: profitability[profitability.length - 1]?.fullName ?? "-",
      worstVehicleMaintenance: profitability[profitability.length - 1]?.maintenanceCost ?? 0,
      worstVehicleUtilization:
        utilizationData.find((item) => item.fullName === profitability[profitability.length - 1]?.fullName)?.utilization ?? 0,
      availableCount: vehicles.filter((item) => item.status === "available").length,
      rentedCount: vehicles.filter((item) => item.status === "rented").length,
      maintenanceCount: vehicles.filter((item) => item.status === "maintenance").length,
      overdueVehicle: lateBooking
        ? `${vehicles.find((item) => item.id === lateBooking.vehicleId)?.name ?? lateBooking.vehicleId} terlambat kembali sejak ${lateBooking.endDate}`
        : "Tidak ada kendaraan terlambat kembali",
      serviceAlertVehicle: vehicles.find((item) => diffDays(item.nextService, TODAY) < 30)?.name ?? "Tidak ada alert servis kritis",
      outstandingCustomer:
        overdueInvoices[0]?.customer?.name ??
        "Tidak ada customer outstanding",
      anomalyList,
    };
  }, [bookings, customers, invoices, maintenance, transactions, vehicles]);

  function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage = { id: `user-${Date.now()}`, role: "user", text: trimmed };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      const reply = buildAssistantResponse(trimmed, analytics);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: reply,
        },
      ]);
      setTyping(false);
    }, 850);
  }

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        .report-print, .report-print * { visibility: visible; }
        .report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 32px; background: white; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <Sparkles className="h-4 w-4" />
              Business intelligence + AI simulation
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Analytics & AI Assistant</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Insight bisnis, prediksi tren, anomaly detection, dan asisten AI berbasis data operasional Choky Rental.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Occupancy Rate", `${analytics.occupancyRate}%`],
          ["Average Revenue Per Unit", formatRupiah(analytics.averageRevenuePerUnit)],
          ["Customer Lifetime Value", formatRupiah(analytics.customerLifetimeValue)],
          ["Cost Per Acquisition", formatRupiah(analytics.costPerAcquisition)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Revenue Forecast">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenueHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatRupiah(value, { compact: true })} />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Legend />
                <Bar dataKey="revenue" fill="#00b8a9" name="Actual Revenue" radius={[8, 8, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="prediction"
                  stroke="#0d1f4e"
                  strokeDasharray="6 4"
                  strokeWidth={3}
                  name="Prediksi AI"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Fleet Utilization">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}%`} />
                <ReferenceLine y={70} stroke="#0d1f4e" strokeDasharray="4 4" label="Target 70%" />
                <Bar dataKey="utilization" radius={[8, 8, 0, 0]}>
                  {analytics.utilizationData.map((item) => (
                    <Cell key={item.fullName} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Customer Segmentation">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bookings" name="Total Booking" />
                <YAxis dataKey="spend" name="Total Spend" tickFormatter={(value) => formatRupiah(value, { compact: true })} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value) => formatRupiah(value)} />
                {["VIP", "Regular", "At-Risk", "New", "Churned"].map((segment, index) => (
                  <Scatter
                    key={segment}
                    name={segment}
                    data={analytics.segmentation.filter((item) => item.segment === segment)}
                    fill={["#f59e0b", "#00b8a9", "#ef4444", "#0d1f4e", "#94a3b8"][index]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {["VIP", "Regular", "At-Risk", "New", "Churned"].map((segment) => (
              <div key={segment} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">{segment}</p>
                <p className="mt-1 text-slate-600">
                  {analytics.segmentation.find((item) => item.segment === segment)?.action ?? "Belum ada action"}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Profitability per Vehicle">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.profitability} layout="vertical" margin={{ left: 24, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => formatRupiah(value, { compact: true })} />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Bar dataKey="net" radius={[0, 10, 10, 0]}>
                  {analytics.profitability.map((item, index) => (
                    <Cell
                      key={item.fullName}
                      fill={index === 0 ? "#10b981" : index === analytics.profitability.length - 1 ? "#ef4444" : "#0d1f4e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">🤖 Choky AI Assistant</h3>
              <p className="text-sm text-emerald-600">online</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {chip === "laporan bulan ini"
                  ? "📊 Laporan Bulan Ini"
                  : chip === "fleet status"
                    ? "🚗 Fleet Status"
                    : chip === "cash flow"
                      ? "💰 Cash Flow"
                      : chip === "alert aktif"
                        ? "⚠️ Alert Aktif"
                        : "🏆 Performa Terbaik"}
              </button>
            ))}
          </div>

          <div className="mt-5 h-[360px] overflow-y-auto rounded-3xl bg-slate-50 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-navy text-white"
                        : "bg-white text-slate-700 shadow-sm"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              {typing ? (
                <div className="flex justify-start">
                  <div className="rounded-3xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
            className="mt-4 flex gap-3"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tanya apa saja tentang bisnis rental..."
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal text-white"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Automated Reports</h3>
            <div className="mt-4 space-y-3">
              {REPORTS.map((report) => (
                <div key={report} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-700">{report}</span>
                  <button
                    type="button"
                    onClick={() => setReportModal(report)}
                    className="rounded-2xl bg-navy px-4 py-2 text-sm font-semibold text-white"
                  >
                    Generate
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h3 className="text-lg font-bold text-slate-900">Anomaly Detection</h3>
            </div>
            <div className="mt-4 space-y-3">
              {analytics.anomalyList.map((item) => (
                <div key={item.title} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">Rekomendasi: {item.action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      {reportModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{reportModal}</h3>
                <p className="mt-1 text-sm text-slate-500">Preview sederhana laporan otomatis sebelum di-download.</p>
              </div>
              <button
                type="button"
                onClick={() => setReportModal(null)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <div className="report-print px-6 py-5">
              <div className="rounded-3xl bg-slate-50 p-5">
                <h4 className="text-lg font-bold text-slate-900">{reportModal}</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Dibuat pada {TODAY.toLocaleDateString("id-ID")} dengan ringkasan: revenue {formatRupiah(
                    analytics.monthRevenue,
                  )}, expense {formatRupiah(analytics.monthExpense)}, profit {formatRupiah(analytics.monthProfit)}.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3 text-sm font-semibold text-white"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 text-slate-500" />
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
