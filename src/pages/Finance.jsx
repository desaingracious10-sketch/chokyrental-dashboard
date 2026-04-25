import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Filter,
  LineChart as LineChartIcon,
  LoaderCircle,
  Plus,
  Printer,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addMonths, formatRupiah, isSameMonth, TODAY } from "../lib/format";
import { useAppContext } from "../context/AppContext";
import EmptyState from "../components/ui/EmptyState";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const EXPENSE_CATEGORIES = ["Bahan Bakar", "Servis", "Gaji Sopir", "Pajak", "Marketing", "Operasional", "Asuransi"];
const INCOME_CATEGORIES = ["Sewa Kendaraan", "Biaya Sopir", "Pelunasan", "Deposit", "Lainnya"];

const EMPTY_FORM = {
  type: "income",
  date: "2026-04-25T10:00",
  category: "Sewa Kendaraan",
  vehicleId: "",
  customerId: "",
  amount: "",
  description: "",
  proofName: "",
};

function getMonthLabel(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getTrend(current, previous) {
  if (previous === 0) {
    return {
      direction: current >= 0 ? "up" : "down",
      label: current === 0 ? "Stabil vs bulan lalu" : "Basis bulan lalu nol",
      percentage: current === 0 ? 0 : 100,
    };
  }

  const delta = current - previous;
  const percentage = Math.round((Math.abs(delta) / Math.max(Math.abs(previous), 1)) * 100);

  return {
    direction: delta >= 0 ? "up" : "down",
    label: `${delta >= 0 ? "Naik" : "Turun"} ${percentage}% vs bulan lalu`,
    percentage,
  };
}

function formatCurrencyInput(value) {
  const digits = value.replace(/\D/g, "");
  return digits ? formatRupiah(Number(digits)) : "";
}

function parseCurrencyInput(value) {
  return Number(String(value).replace(/\D/g, "")) || 0;
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportTransactionsCsv(transactions) {
  const header = ["Tanggal", "Tipe", "Kategori", "Deskripsi", "Jumlah"];
  const lines = transactions.map((item) =>
    [item.date, item.type, item.category, item.description, item.amount].join(","),
  );
  downloadTextFile("laporan-keuangan.csv", [header.join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
}

function exportPnLToPrint(summary, periodLabel) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;

  popup.document.write(`
    <html>
      <head><title>Laporan P&L ${periodLabel}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 32px;">
        <h1>Laporan Profit & Loss</h1>
        <p>Periode: ${periodLabel}</p>
        <table style="width:100%; border-collapse: collapse; margin-top:24px;">
          <tr><td style="padding:8px; border-bottom:1px solid #ddd;">Revenue</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${formatRupiah(summary.revenue)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #ddd;">COGS</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${formatRupiah(summary.cogs)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #ddd; font-weight:bold;">Gross Profit</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${formatRupiah(summary.grossProfit)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #ddd;">Operating Expenses</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${formatRupiah(summary.operatingExpenses)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #ddd; font-weight:bold;">Net Profit</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${formatRupiah(summary.netProfit)}</td></tr>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function Finance() {
  const {
    state: { transactions, vehicles, customers, bookings, invoices },
    dispatch,
    pushToast,
  } = useAppContext();
  const [activeTab, setActiveTab] = useState("income");
  const [incomePeriod, setIncomePeriod] = useState("all");
  const [incomeCategory, setIncomeCategory] = useState("all");
  const [incomeVehicle, setIncomeVehicle] = useState("all");
  const [expensePeriod, setExpensePeriod] = useState("all");
  const [expenseCategory, setExpenseCategory] = useState("all");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [pnlPeriodType, setPnlPeriodType] = useState("monthly");
  const [cashOpeningBalance, setCashOpeningBalance] = useState(3500000);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((item) => [item.id, item])), []);
  const customerMap = useMemo(() => Object.fromEntries(customers.map((item) => [item.id, item])), []);
  const bookingMap = useMemo(() => Object.fromEntries(bookings.map((item) => [item.id, item])), []);

  const enrichedTransactions = useMemo(() => {
    return transactions.map((transaction) => {
      const relatedBooking = transaction.bookingId ? bookingMap[transaction.bookingId] : null;
      const vehicle = relatedBooking?.vehicleId ? vehicleMap[relatedBooking.vehicleId] : vehicleMap[transaction.vehicleId];
      const customer = relatedBooking?.customerId ? customerMap[relatedBooking.customerId] : customerMap[transaction.customerId];
      return {
        ...transaction,
        vehicle,
        customer,
        status: transaction.type === "income" ? "Tercatat" : "Posted",
      };
    });
  }, [transactions, bookingMap, vehicleMap, customerMap]);

  const financeSummary = useMemo(() => {
    const currentMonthDate = TODAY;
    const previousMonthDate = addMonths(TODAY, -1);

    const currentMonthTransactions = enrichedTransactions.filter((item) =>
      isSameMonth(new Date(item.date), currentMonthDate),
    );
    const previousMonthTransactions = enrichedTransactions.filter((item) =>
      isSameMonth(new Date(item.date), previousMonthDate),
    );

    const incomeCurrent = currentMonthTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);
    const incomePrevious = previousMonthTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const expenseCurrent = currentMonthTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
    const expensePrevious = previousMonthTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    const netCurrent = incomeCurrent - expenseCurrent;
    const netPrevious = incomePrevious - expensePrevious;

    const outstandingCurrent = invoices
      .filter((invoice) => invoice.balanceDue > 0)
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);
    const outstandingPrevious = invoices
      .filter((invoice) => invoice.status === "Sebagian Bayar")
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);

    const sparkline = Array.from({ length: 6 }, (_, index) => {
      const monthDate = addMonths(TODAY, index - 5);
      const monthTransactions = enrichedTransactions.filter((item) => isSameMonth(new Date(item.date), monthDate));
      const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
      const expense = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
      return {
        label: getMonthLabel(monthDate),
        income,
        expense,
        net: income - expense,
      };
    });

    return {
      incomeCurrent,
      expenseCurrent,
      netCurrent,
      outstandingCurrent,
      trends: {
        income: getTrend(incomeCurrent, incomePrevious),
        expense: getTrend(expenseCurrent, expensePrevious),
        net: getTrend(netCurrent, netPrevious),
        outstanding: getTrend(outstandingCurrent, outstandingPrevious),
      },
      sparkline,
    };
  }, [enrichedTransactions, invoices]);

  const monthlyChartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = addMonths(TODAY, index - 11);
      const monthTransactions = enrichedTransactions.filter((item) => isSameMonth(new Date(item.date), monthDate));
      return {
        month: getMonthLabel(monthDate),
        income: monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0),
        expense: monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
      };
    });
  }, [enrichedTransactions]);

  const expenseBreakdown = useMemo(() => {
    const palette = ["#0d1f4e", "#00b8a9", "#14b8a6", "#f59e0b", "#ef4444", "#6366f1", "#94a3b8"];
    return EXPENSE_CATEGORIES.map((category, index) => ({
      name: category,
      value: enrichedTransactions
        .filter((item) => item.type === "expense" && item.category === category)
        .reduce((sum, item) => sum + item.amount, 0),
      color: palette[index % palette.length],
    })).filter((item) => item.value > 0);
  }, [enrichedTransactions]);

  const periodOptions = useMemo(() => {
    const keys = Array.from(new Set(enrichedTransactions.map((item) => monthKey(item.date))));
    return keys.sort((a, b) => (a < b ? 1 : -1));
  }, [enrichedTransactions]);

  const incomeRows = useMemo(() => {
    return enrichedTransactions.filter((item) => {
      if (item.type !== "income") return false;
      if (incomePeriod !== "all" && monthKey(item.date) !== incomePeriod) return false;
      if (incomeCategory !== "all" && item.category !== incomeCategory) return false;
      if (incomeVehicle !== "all" && item.vehicle?.id !== incomeVehicle) return false;
      return true;
    });
  }, [enrichedTransactions, incomePeriod, incomeCategory, incomeVehicle]);

  const expenseRows = useMemo(() => {
    return enrichedTransactions.filter((item) => {
      if (item.type !== "expense") return false;
      if (expensePeriod !== "all" && monthKey(item.date) !== expensePeriod) return false;
      if (expenseCategory !== "all" && item.category !== expenseCategory) return false;
      if (
        expenseSearch &&
        !`${item.description} ${item.category} ${item.vehicle?.name ?? ""}`
          .toLowerCase()
          .includes(expenseSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [enrichedTransactions, expensePeriod, expenseCategory, expenseSearch]);

  const pnlSummary = useMemo(() => {
    const relevantTransactions = enrichedTransactions.filter((item) => {
      if (pnlPeriodType === "monthly") return isSameMonth(new Date(item.date), TODAY);
      return new Date(item.date).getFullYear() === TODAY.getFullYear();
    });

    const revenue = relevantTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const cogs = relevantTransactions
      .filter((item) => item.type === "expense" && ["Bahan Bakar", "Servis"].includes(item.category))
      .reduce((sum, item) => sum + item.amount, 0);
    const operatingExpenses = relevantTransactions
      .filter((item) => item.type === "expense" && !["Bahan Bakar", "Servis"].includes(item.category))
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      operatingExpenses,
      netProfit: revenue - cogs - operatingExpenses,
      periodLabel: pnlPeriodType === "monthly" ? getMonthLabel(TODAY) : String(TODAY.getFullYear()),
    };
  }, [enrichedTransactions, pnlPeriodType]);

  const cashTransactionsToday = useMemo(() => {
    return enrichedTransactions.filter((item) => {
      const date = new Date(item.date);
      return date.toDateString() === TODAY.toDateString();
    });
  }, [enrichedTransactions]);

  const cashTotals = useMemo(() => {
    const income = cashTransactionsToday.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = cashTransactionsToday.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    return {
      income,
      expense,
      closing: cashOpeningBalance + income - expense,
    };
  }, [cashTransactionsToday, cashOpeningBalance]);

  function openModal(type = "income") {
    setTransactionForm({
      ...EMPTY_FORM,
      type,
      category: type === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    });
    setIsModalOpen(true);
  }

  async function handleSaveTransaction(event) {
    event.preventDefault();
    setIsSaving(true);

    const amount = parseCurrencyInput(transactionForm.amount);
    const payload = {
      id: `TRX-${String(transactions.length + 1).padStart(3, "0")}`,
      date: transactionForm.date.slice(0, 10),
      type: transactionForm.type,
      category: transactionForm.category,
      description: transactionForm.description,
      amount,
      method: transactionForm.proofName ? "Upload Bukti" : "Manual Entry",
      bookingId: null,
      vehicleId: transactionForm.vehicleId || null,
      customerId: transactionForm.customerId || null,
      proofName: transactionForm.proofName || null,
    };

    await new Promise((resolve) => setTimeout(resolve, 500));
    dispatch({ type: "ADD", entity: "transactions", payload });
    setIsSaving(false);
    setIsModalOpen(false);
    pushToast({
      type: "success",
      title: form.type === "income" ? "Pemasukan berhasil dicatat" : "Pengeluaran berhasil dicatat",
      message: payload.description,
    });
  }

  function handleCloseCashier() {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head><title>Rekap Kasir Harian</title></head>
        <body style="font-family: Arial, sans-serif; padding: 32px;">
          <h1>Rekap Kasir Harian</h1>
          <p>Tanggal: ${TODAY.toLocaleDateString("id-ID")}</p>
          <p>Saldo awal: ${formatRupiah(cashOpeningBalance)}</p>
          <p>Total masuk: ${formatRupiah(cashTotals.income)}</p>
          <p>Total keluar: ${formatRupiah(cashTotals.expense)}</p>
          <p><strong>Saldo akhir: ${formatRupiah(cashTotals.closing)}</strong></p>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  const summaryCards = [
    {
      key: "income",
      title: "Total Pemasukan Bulan Ini",
      value: financeSummary.incomeCurrent,
      trend: financeSummary.trends.income,
      series: financeSummary.sparkline.map((item) => ({ value: item.income, label: item.label })),
      tone: "text-navy",
    },
    {
      key: "expense",
      title: "Total Pengeluaran",
      value: financeSummary.expenseCurrent,
      trend: financeSummary.trends.expense,
      series: financeSummary.sparkline.map((item) => ({ value: item.expense, label: item.label })),
      tone: "text-rose-600",
    },
    {
      key: "net",
      title: "Laba Bersih",
      value: financeSummary.netCurrent,
      trend: financeSummary.trends.net,
      series: financeSummary.sparkline.map((item) => ({ value: item.net, label: item.label })),
      tone: financeSummary.netCurrent >= 0 ? "text-emerald-600" : "text-rose-600",
    },
    {
      key: "outstanding",
      title: "Outstanding",
      value: financeSummary.outstandingCurrent,
      trend: financeSummary.trends.outstanding,
      series: financeSummary.sparkline.map((item) => ({ value: item.income - item.net, label: item.label })),
      tone: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <Wallet className="h-4 w-4" />
              Finance operations cockpit
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Finance Dashboard</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Ringkas pemasukan, pengeluaran, P&amp;L, dan kasir harian dalam satu halaman yang siap dipresentasikan.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openModal("income")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-navy"
            >
              <Plus className="h-4 w-4" />
              Tambah Pemasukan
            </button>
            <button
              type="button"
              onClick={() => openModal("expense")}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-5 text-sm font-semibold text-white"
            >
              <Receipt className="h-4 w-4" />
              Catat Pengeluaran
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.key} card={card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-slate-500" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Income vs Expense 12 Bulan</h3>
              <p className="text-sm text-slate-500">Tren utama arus kas perusahaan dari 12 bulan terakhir.</p>
            </div>
          </div>

          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00b8a9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00b8a9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#00b8a9"
                  fill="url(#incomeGradient)"
                  strokeWidth={3}
                  name="Income"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#ef4444"
                  fill="url(#expenseGradient)"
                  strokeWidth={3}
                  name="Expense"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Breakdown Pengeluaran</h3>
          <p className="mt-1 text-sm text-slate-500">Distribusi kategori biaya operasional utama.</p>

          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Pie
                  data={expenseBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                >
                  {expenseBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Finance Tabs</h3>
            <p className="text-sm text-slate-500">Kelola arus kas, laporan laba rugi, dan kasir harian.</p>
          </div>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              ["income", "Pemasukan"],
              ["expense", "Pengeluaran"],
              ["pnl", "Laporan P&L"],
              ["cashier", "Kasir Harian"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === key ? "bg-white text-navy shadow-sm" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "income" ? (
          <div className="mt-6 space-y-5">
            <FilterRow>
              <SelectFilter label="Periode" value={incomePeriod} onChange={setIncomePeriod} options={periodOptions} />
              <SelectFilter label="Kategori" value={incomeCategory} onChange={setIncomeCategory} options={["all", ...INCOME_CATEGORIES]} />
              <SelectFilter label="Kendaraan" value={incomeVehicle} onChange={setIncomeVehicle} options={["all", ...vehicles.map((item) => item.id)]} optionLabel={(value) => value === "all" ? "Semua kendaraan" : vehicleMap[value]?.name ?? value} />
              <PrimaryButton onClick={() => openModal("income")} icon={Plus}>Tambah Pemasukan</PrimaryButton>
            </FilterRow>

            <FinanceTable
              rows={incomeRows}
              columns={["Tanggal", "Deskripsi", "Kategori", "Kendaraan", "Customer", "Jumlah", "Status"]}
              renderRow={(row) => (
                <>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.description}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.vehicle?.name ?? "-"}</td>
                  <td className="px-4 py-3">{row.customer?.name ?? "-"}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{formatRupiah(row.amount)}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone="bg-emerald-100 text-emerald-700">{row.status}</StatusChip>
                  </td>
                </>
              )}
            />

            <TotalFooter label="Total Pemasukan" value={incomeRows.reduce((sum, row) => sum + row.amount, 0)} />
          </div>
        ) : null}

        {activeTab === "expense" ? (
          <div className="mt-6 space-y-5">
            <FilterRow>
              <SelectFilter label="Periode" value={expensePeriod} onChange={setExpensePeriod} options={periodOptions} />
              <SelectFilter label="Kategori" value={expenseCategory} onChange={setExpenseCategory} options={["all", ...EXPENSE_CATEGORIES]} />
              <label className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={expenseSearch}
                  onChange={(event) => setExpenseSearch(event.target.value)}
                  placeholder="Cari pengeluaran..."
                  className="h-11 w-full bg-transparent text-sm outline-none"
                />
              </label>
              <PrimaryButton onClick={() => openModal("expense")} icon={Plus}>Catat Pengeluaran</PrimaryButton>
            </FilterRow>

            <FinanceTable
              rows={expenseRows}
              columns={["Tanggal", "Deskripsi", "Kategori", "Kendaraan", "Jumlah", "Bukti", "Status"]}
              renderRow={(row) => (
                <>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.description}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.vehicle?.name ?? "-"}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">{formatRupiah(row.amount)}</td>
                  <td className="px-4 py-3">{row.proofName ?? "Belum ada"}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone="bg-slate-100 text-slate-700">{row.status}</StatusChip>
                  </td>
                </>
              )}
            />

            <TotalFooter label="Total Pengeluaran" value={expenseRows.reduce((sum, row) => sum + row.amount, 0)} />
          </div>
        ) : null}

        {activeTab === "pnl" ? (
          <div className="mt-6 space-y-5">
            <FilterRow>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["monthly", "Bulanan"],
                  ["yearly", "Tahunan"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPnlPeriodType(key)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      pnlPeriodType === key ? "bg-white text-navy shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <PrimaryButton onClick={() => exportPnLToPrint(pnlSummary, pnlSummary.periodLabel)} icon={Printer}>
                  Export PDF
                </PrimaryButton>
                <PrimaryButton onClick={() => exportTransactionsCsv(enrichedTransactions)} icon={FileSpreadsheet}>
                  Export Excel
                </PrimaryButton>
              </div>
            </FilterRow>

            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <tbody>
                  <PnLRow label="Revenue: Sewa kendaraan, biaya sopir, dll" value={pnlSummary.revenue} />
                  <PnLRow label="COGS: BBM, servis" value={pnlSummary.cogs} negative />
                  <PnLRow label="Gross Profit" value={pnlSummary.grossProfit} strong />
                  <PnLRow label="Operating Expenses: Gaji, marketing, operasional" value={pnlSummary.operatingExpenses} negative />
                  <PnLRow label="Net Profit" value={pnlSummary.netProfit} strong success={pnlSummary.netProfit >= 0} />
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "cashier" ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <CashTile label="Saldo Kas Awal Hari Ini" value={formatRupiah(cashOpeningBalance)} />
              <CashTile label="Total Masuk Hari Ini" value={formatRupiah(cashTotals.income)} tone="text-emerald-600" />
              <CashTile label="Saldo Akhir" value={formatRupiah(cashTotals.closing)} tone={cashTotals.closing >= 0 ? "text-navy" : "text-rose-600"} />
            </div>

            <FinanceTable
              rows={cashTransactionsToday}
              columns={["Waktu", "Tipe", "Deskripsi", "Kategori", "Jumlah"]}
              renderRow={(row) => (
                <>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={row.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                      {row.type === "income" ? "Masuk" : "Keluar"}
                    </StatusChip>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.description}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className={`px-4 py-3 font-semibold ${row.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatRupiah(row.amount)}
                  </td>
                </>
              )}
            />

            <div className="flex justify-end">
              <PrimaryButton onClick={handleCloseCashier} icon={Printer}>
                Tutup Kasir
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Tambah Transaksi</h3>
                <p className="mt-1 text-sm text-slate-500">Masukkan transaksi pemasukan atau pengeluaran baru.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-5 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput
                  label="Type"
                  value={transactionForm.type}
                  onChange={(value) =>
                    setTransactionForm((current) => ({
                      ...current,
                      type: value,
                      category: value === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
                    }))
                  }
                  options={[
                    { value: "income", label: "Pemasukan" },
                    { value: "expense", label: "Pengeluaran" },
                  ]}
                />
                <TextInput
                  label="Tanggal & Jam"
                  type="datetime-local"
                  value={transactionForm.date}
                  onChange={(value) => setTransactionForm((current) => ({ ...current, date: value }))}
                />
                <SelectInput
                  label="Kategori"
                  value={transactionForm.category}
                  onChange={(value) => setTransactionForm((current) => ({ ...current, category: value }))}
                  options={(transactionForm.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
                <SelectInput
                  label="Kendaraan Terkait"
                  value={transactionForm.vehicleId}
                  onChange={(value) => setTransactionForm((current) => ({ ...current, vehicleId: value }))}
                  options={[{ value: "", label: "Optional" }, ...vehicles.map((item) => ({ value: item.id, label: item.name }))]}
                />
                <SelectInput
                  label="Customer Terkait"
                  value={transactionForm.customerId}
                  onChange={(value) => setTransactionForm((current) => ({ ...current, customerId: value }))}
                  options={[{ value: "", label: "Optional" }, ...customers.map((item) => ({ value: item.id, label: item.name }))]}
                />
                <TextInput
                  label="Jumlah"
                  value={transactionForm.amount}
                  onChange={(value) =>
                    setTransactionForm((current) => ({ ...current, amount: formatCurrencyInput(value) }))
                  }
                  placeholder="Rp 0"
                />
                <TextInput
                  label="Keterangan"
                  value={transactionForm.description}
                  onChange={(value) => setTransactionForm((current) => ({ ...current, description: value }))}
                />
                <TextInput
                  label="Upload Bukti"
                  value={transactionForm.proofName}
                  onChange={(value) => setTransactionForm((current) => ({ ...current, proofName: value }))}
                  placeholder="Nama file bukti transfer / kwitansi"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-teal px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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

function SummaryCard({ card }) {
  const TrendIcon = card.trend.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{card.title}</p>
          <p className={`mt-2 text-3xl font-bold ${card.tone}`}>{formatRupiah(card.value)}</p>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${card.trend.direction === "up" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          <TrendIcon className="h-3 w-3" />
          {card.trend.label}
        </div>
      </div>

      <div className="mt-4 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={card.series}>
            <Tooltip formatter={(value) => formatRupiah(value)} />
            <Area type="monotone" dataKey="value" stroke="#00b8a9" fill="#00b8a933" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function FilterRow({ children }) {
  return <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">{children}</div>;
}

function SelectFilter({ label, value, onChange, options, optionLabel }) {
  return (
    <label className="block min-w-[180px]">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal"
      >
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const labelText =
            typeof option === "string"
              ? optionLabel
                ? optionLabel(option)
                : option === "all"
                  ? `Semua ${label.toLowerCase()}`
                  : option
              : option.label;
          return (
            <option key={value} value={value}>
              {labelText}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function PrimaryButton({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-navy px-5 text-sm font-semibold text-white"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function FinanceTable({ rows, columns, renderRow }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200">
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ tone, children }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
}

function TotalFooter({ label, value }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl bg-slate-50 px-5 py-3 text-right">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{formatRupiah(value)}</p>
      </div>
    </div>
  );
}

function PnLRow({ label, value, negative = false, strong = false, success = true }) {
  return (
    <tr className="border-t border-slate-200 first:border-t-0">
      <td className={`px-5 py-4 ${strong ? "font-bold text-slate-900" : "text-slate-600"}`}>{label}</td>
      <td
        className={`px-5 py-4 text-right ${
          strong
            ? success
              ? "font-bold text-emerald-600"
              : "font-bold text-rose-600"
            : negative
              ? "font-semibold text-rose-600"
              : "font-semibold text-slate-900"
        }`}
      >
        {formatRupiah(value)}
      </td>
    </tr>
  );
}

function CashTile({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function SelectInput({ label, value, onChange, options }) {
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

function TextInput({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal"
      />
    </label>
  );
}
