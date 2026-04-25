import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { TODAY, addDays, diffDays, formatRupiah } from "../lib/format";
import { useAppContext } from "../context/AppContext";
import EmptyState from "../components/ui/EmptyState";

const COMPANY_INFO = {
  name: "Choky Rental Solutions",
  address: "Jl. Bintara 6 No.79M, Bekasi Barat",
  whatsapp: "081272004197",
  bankAccounts: [
    "BCA: 6630844931 a/n Zainal Candra",
    "Mandiri: 1670000536523 a/n Zainal Candra",
  ],
};

const STATUS_META = {
  Draft: "bg-slate-100 text-slate-700",
  Terkirim: "bg-sky-100 text-sky-700",
  "Sebagian Bayar": "bg-amber-100 text-amber-700",
  Lunas: "bg-emerald-100 text-emerald-700",
  Overdue: "bg-rose-100 text-rose-700",
};

const EMPTY_INVOICE_FORM = {
  source: "booking",
  bookingId: "",
  customerId: "",
  vehicleId: "",
  driverId: "",
  issueDate: TODAY.toISOString().slice(0, 10),
  dueDate: addDays(TODAY, 7).toISOString().slice(0, 10),
  startDate: TODAY.toISOString().slice(0, 10),
  endDate: addDays(TODAY, 2).toISOString().slice(0, 10),
  subtotal: "0",
  driverFee: "0",
  fuelEstimate: "0",
  discount: "0",
  depositPaid: "0",
  notes: "",
  status: "Draft",
};

function makeInvoiceNumber(index) {
  return `INV-2026-${String(index + 1).padStart(3, "0")}`;
}

function parseMoney(value) {
  return Number(String(value).replace(/\D/g, "")) || 0;
}

function formatMoneyInput(value) {
  const n = parseMoney(value);
  return n ? formatRupiah(n) : "";
}

function computeInvoiceStatus(invoice) {
  if (invoice.balanceDue <= 0) return "Lunas";
  if (invoice.paymentHistory.length > 0) {
    return diffDays(TODAY, invoice.dueDate) > 7 ? "Overdue" : "Sebagian Bayar";
  }
  if (invoice.status === "Draft") return "Draft";
  if (diffDays(TODAY, invoice.dueDate) > 7) return "Overdue";
  return "Terkirim";
}

function formatDateLong(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function createShareLink(invoiceNo) {
  return `https://chokyrental.demo/invoice/${invoiceNo.toLowerCase()}`;
}

export default function Invoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    state: { invoices: invoiceList, bookings, customers, vehicles, drivers },
    dispatch,
    pushToast,
  } = useAppContext();
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(() => invoiceList[0]?.id ?? null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE_FORM);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Transfer BCA" });
  const [isSaving, setIsSaving] = useState(false);

  const periodOptions = useMemo(() => {
    const values = Array.from(new Set(invoiceList.map((item) => item.issueDate.slice(0, 7))));
    return values.sort((a, b) => (a < b ? 1 : -1));
  }, [invoiceList]);

  const filteredInvoices = useMemo(() => {
    return invoiceList.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
      if (periodFilter !== "all" && invoice.issueDate.slice(0, 7) !== periodFilter) return false;
      if (customerFilter !== "all" && invoice.customerId !== customerFilter) return false;
      if (vehicleFilter !== "all" && invoice.vehicleId !== vehicleFilter) return false;
      if (
        search &&
        !`${invoice.invoiceNo} ${invoice.customer?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [invoiceList, statusFilter, periodFilter, customerFilter, vehicleFilter, search]);

  const selectedInvoice = useMemo(
    () => invoiceList.find((item) => item.id === selectedInvoiceId) ?? filteredInvoices[0] ?? null,
    [invoiceList, selectedInvoiceId, filteredInvoices],
  );

  const paginatedInvoices = filteredInvoices.slice((page - 1) * 10, page * 10);
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / 10));

  const overdueInvoices = useMemo(
    () => invoiceList.filter((item) => item.status === "Overdue"),
    [invoiceList],
  );

  const bookingOptions = useMemo(() => {
    return bookings.map((booking) => {
      const customer = customers.find((item) => item.id === booking.customerId);
      const vehicle = vehicles.find((item) => item.id === booking.vehicleId);
      return {
        booking,
        label: `${booking.id} • ${customer?.name ?? "-"} • ${vehicle?.name ?? "-"}`,
      };
    });
  }, []);

  const previewInvoice = useMemo(() => {
    if (!isModalOpen) return selectedInvoice;

    const customer = customers.find((item) => item.id === invoiceForm.customerId);
    const vehicle = vehicles.find((item) => item.id === invoiceForm.vehicleId);
    const driver = invoiceForm.driverId ? drivers.find((item) => item.id === invoiceForm.driverId) : null;
    const subtotal = parseMoney(invoiceForm.subtotal);
    const driverFee = parseMoney(invoiceForm.driverFee);
    const fuelEstimate = parseMoney(invoiceForm.fuelEstimate);
    const discount = parseMoney(invoiceForm.discount);
    const depositPaid = parseMoney(invoiceForm.depositPaid);
    const grossTotal = subtotal + driverFee + fuelEstimate - discount;
    const balanceDue = Math.max(grossTotal - depositPaid, 0);

    return {
      id: "preview",
      invoiceNo: modalMode === "edit" && selectedInvoice ? selectedInvoice.invoiceNo : makeInvoiceNumber(invoiceList.length),
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      customer,
      vehicle,
      driver,
      customerId: customer?.id ?? "",
      vehicleId: vehicle?.id ?? "",
      driverId: driver?.id ?? "",
      startDate: invoiceForm.startDate,
      endDate: invoiceForm.endDate,
      durationDays: Math.max(diffDays(invoiceForm.endDate, invoiceForm.startDate), 0),
      subtotal,
      driverFee,
      fuelEstimate,
      discount,
      depositPaid,
      grossTotal,
      balanceDue,
      total: grossTotal,
      status: invoiceForm.status,
      notes: invoiceForm.notes,
      paymentHistory: [],
    };
  }, [isModalOpen, invoiceForm, selectedInvoice, modalMode, invoiceList.length]);

  useEffect(() => {
    const invoiceId = searchParams.get("invoiceId");
    const bookingId = searchParams.get("bookingId") ?? location.state?.bookingId;

    if (invoiceId) {
      setSelectedInvoiceId(invoiceId);
    }

    if (bookingId && (location.state?.openNewInvoice || searchParams.get("open") === "create")) {
      setModalMode("create");
      setInvoiceForm(EMPTY_INVOICE_FORM);
      setIsModalOpen(true);
      hydrateFromBooking(bookingId);
    } else if (location.state?.openNewInvoice) {
      openCreateModal();
    }
  }, [location.state, searchParams]);

  useEffect(() => {
    function handleEscape() {
      setIsModalOpen(false);
    }

    window.addEventListener("app:escape", handleEscape);
    return () => window.removeEventListener("app:escape", handleEscape);
  }, []);

  function openCreateModal() {
    setModalMode("create");
    setInvoiceForm(EMPTY_INVOICE_FORM);
    setPaymentForm({ amount: "", method: "Transfer BCA" });
    setIsModalOpen(true);
  }

  function openEditModal(invoice) {
    setModalMode("edit");
    setInvoiceForm({
      source: "manual",
      bookingId: invoice.bookingId ?? "",
      customerId: invoice.customerId,
      vehicleId: invoice.vehicleId,
      driverId: invoice.driverId ?? "",
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      startDate: invoice.startDate,
      endDate: invoice.endDate,
      subtotal: String(invoice.subtotal),
      driverFee: String(invoice.driverFee),
      fuelEstimate: String(invoice.fuelEstimate),
      discount: String(invoice.discount),
      depositPaid: String(invoice.depositPaid),
      notes: invoice.notes ?? "",
      status: invoice.status,
    });
    setPaymentForm({ amount: "", method: "Transfer BCA" });
    setSelectedInvoiceId(invoice.id);
    setIsModalOpen(true);
  }

  function hydrateFromBooking(bookingId) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const vehicle = vehicles.find((item) => item.id === booking.vehicleId);

    setInvoiceForm((current) => ({
      ...current,
      bookingId,
      customerId: booking.customerId,
      vehicleId: booking.vehicleId,
      driverId: booking.driverId ?? "",
      issueDate: booking.startDate,
      dueDate: addDays(booking.startDate, 7).toISOString().slice(0, 10),
      startDate: booking.startDate,
      endDate: booking.endDate,
      subtotal: String(booking.subtotal),
      driverFee: String(booking.type === "dengan-sopir" ? booking.totalDays * 250000 : 0),
      fuelEstimate: String(booking.type === "dengan-sopir" ? booking.totalDays * 100000 : Math.round(booking.total * 0.06)),
      discount: "0",
      depositPaid: String(booking.paymentStatus === "paid" ? booking.deposit : booking.paymentStatus === "dp" ? Math.round(booking.deposit * 0.4) : 0),
      notes: vehicle ? `Invoice otomatis untuk ${vehicle.name}` : "",
    }));
  }

  async function saveInvoice(event) {
    event.preventDefault();
    setIsSaving(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const customer = customers.find((item) => item.id === invoiceForm.customerId) ?? null;
    const vehicle = vehicles.find((item) => item.id === invoiceForm.vehicleId) ?? null;
    const driver = invoiceForm.driverId ? drivers.find((item) => item.id === invoiceForm.driverId) : null;
    const subtotal = parseMoney(invoiceForm.subtotal);
    const driverFee = parseMoney(invoiceForm.driverFee);
    const fuelEstimate = parseMoney(invoiceForm.fuelEstimate);
    const discount = parseMoney(invoiceForm.discount);
    const depositPaid = parseMoney(invoiceForm.depositPaid);
    const grossTotal = subtotal + driverFee + fuelEstimate - discount;
    const balanceDue = Math.max(grossTotal - depositPaid, 0);

    const payload = {
      id: modalMode === "edit" && selectedInvoice ? selectedInvoice.id : `invoice-${Date.now()}`,
      invoiceNo: modalMode === "edit" && selectedInvoice ? selectedInvoice.invoiceNo : makeInvoiceNumber(invoiceList.length),
      bookingId: invoiceForm.bookingId || null,
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      customerId: customer?.id ?? "",
      vehicleId: vehicle?.id ?? "",
      driverId: driver?.id ?? "",
      customer,
      vehicle,
      driver,
      startDate: invoiceForm.startDate,
      endDate: invoiceForm.endDate,
      durationDays: Math.max(diffDays(invoiceForm.endDate, invoiceForm.startDate), 0),
      subtotal,
      driverFee,
      fuelEstimate,
      discount,
      depositPaid,
      grossTotal,
      balanceDue,
      total: grossTotal,
      status: computeInvoiceStatus({
        balanceDue,
        paymentHistory: depositPaid ? [{ amount: depositPaid }] : [],
        dueDate: invoiceForm.dueDate,
        status: invoiceForm.status,
      }),
      createdAt: invoiceForm.issueDate,
      notes: invoiceForm.notes,
      paymentHistory:
        modalMode === "edit" && selectedInvoice
          ? selectedInvoice.paymentHistory
          : depositPaid
            ? [{ id: `pay-${Date.now()}`, date: invoiceForm.issueDate, amount: depositPaid, method: "DP Awal" }]
            : [],
    };

    if (modalMode === "edit" && selectedInvoice) {
      dispatch({ type: "UPDATE", entity: "invoices", id: selectedInvoice.id, payload });
    } else {
      dispatch({ type: "ADD", entity: "invoices", payload });
    }

    setSelectedInvoiceId(payload.id);
    setIsSaving(false);
    setIsModalOpen(false);
    pushToast({
      type: "success",
      title: modalMode === "edit" ? "Invoice berhasil diperbarui" : "Invoice berhasil disimpan",
      message: payload.invoiceNo,
    });
  }

  function markAsPaid(invoiceId) {
    const amount = parseMoney(paymentForm.amount) || selectedInvoice?.balanceDue || 0;
    const method = paymentForm.method;

    const invoice = invoiceList.find((item) => item.id === invoiceId);
    if (!invoice) return;
    const paymentHistory = [
      ...invoice.paymentHistory,
      { id: `pay-${Date.now()}`, date: TODAY.toISOString().slice(0, 10), amount, method },
    ];
    const depositPaid = invoice.depositPaid + amount;
    const balanceDue = Math.max(invoice.total - depositPaid, 0);

    dispatch({
      type: "UPDATE",
      entity: "invoices",
      id: invoiceId,
      payload: {
        paymentHistory,
        depositPaid,
        balanceDue,
        status: balanceDue <= 0 ? "Lunas" : "Sebagian Bayar",
      },
    });
    setPaymentForm({ amount: "", method: "Transfer BCA" });
    pushToast({
      type: "success",
      title: balanceDue <= 0 ? "Invoice sudah lunas" : "Payment berhasil ditambahkan",
      message: invoice.invoiceNo,
    });
  }

  function deleteInvoice(invoiceId) {
    dispatch({ type: "DELETE", entity: "invoices", id: invoiceId });
    if (selectedInvoiceId === invoiceId) {
      setSelectedInvoiceId(null);
    }
    pushToast({
      type: "success",
      title: "Invoice berhasil dihapus",
      message: "Daftar invoice sudah diperbarui.",
    });
  }

  function shareLink(invoice) {
    navigator.clipboard.writeText(createShareLink(invoice.invoiceNo));
    pushToast({
      type: "info",
      title: "Link invoice disalin",
      message: invoice.invoiceNo,
    });
  }

  function sendWhatsApp(invoice, reminder = false) {
    const phone = invoice.customer?.phone?.replace(/^0/, "62") ?? "";
    const message = reminder
      ? `Halo ${invoice.customer?.name}, reminder tagihan invoice ${invoice.invoiceNo}. Sisa tagihan Anda ${formatRupiah(invoice.balanceDue)} dan jatuh tempo ${formatDateLong(invoice.dueDate)}.`
      : `Halo ${invoice.customer?.name}, berikut invoice ${invoice.invoiceNo} dari Choky Rental. Total tagihan ${formatRupiah(invoice.balanceDue)}. Link: ${createShareLink(invoice.invoiceNo)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    pushToast({
      type: "info",
      title: reminder ? "Reminder dibuka di WhatsApp" : "Invoice dibuka di WhatsApp",
      message: invoice.invoiceNo,
    });
  }

  function printInvoice(invoice) {
    const popup = window.open("", "_blank", "width=980,height=720");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>${invoice.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color:#0f172a; }
            .wrap { border:1px solid #cbd5e1; border-radius:24px; overflow:hidden; }
            .head, .section, .foot, .row { padding:20px 24px; }
            .head { display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; }
            .section { border-bottom:1px solid #cbd5e1; }
            .row { display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; }
            .total { font-weight:bold; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="head">
              <div>
                <h2 style="margin:0;">CHOKY RENTAL</h2>
                <div>${COMPANY_INFO.name}</div>
                <div>${COMPANY_INFO.address}</div>
              </div>
              <div style="text-align:right;">
                <h1 style="margin:0;">INVOICE</h1>
                <div>No: ${invoice.invoiceNo}</div>
                <div>Tgl: ${formatDateLong(invoice.issueDate)}</div>
                <div>Jatuh Tempo: ${formatDateLong(invoice.dueDate)}</div>
              </div>
            </div>
            <div class="section">
              <strong>TAGIHAN KEPADA:</strong>
              <div>${invoice.customer?.name ?? "-"}</div>
              <div>${invoice.customer?.phone ?? "-"}</div>
              <div>${invoice.customer?.address ?? "-"}</div>
            </div>
            <div class="section">
              <strong>DETAIL LAYANAN:</strong>
              <div>Kendaraan: ${invoice.vehicle?.name ?? "-"}</div>
              <div>Sopir: ${invoice.driver?.name ?? "-"}</div>
              <div>Mulai: ${invoice.startDate}</div>
              <div>Selesai: ${invoice.endDate}</div>
              <div>Durasi: ${invoice.durationDays} hari</div>
            </div>
            <div class="row"><span>Sewa Kendaraan</span><span>${formatRupiah(invoice.subtotal)}</span></div>
            <div class="row"><span>Biaya Sopir</span><span>${formatRupiah(invoice.driverFee)}</span></div>
            <div class="row"><span>BBM Estimasi</span><span>${formatRupiah(invoice.fuelEstimate)}</span></div>
            <div class="row"><span>Diskon</span><span>- ${formatRupiah(invoice.discount)}</span></div>
            <div class="row"><span>DP Diterima</span><span>- ${formatRupiah(invoice.depositPaid)}</span></div>
            <div class="row total"><span>SISA TAGIHAN</span><span>${formatRupiah(invoice.balanceDue)}</span></div>
            <div class="foot">
              <div>Pembayaran via:</div>
              ${COMPANY_INFO.bankAccounts.map((account) => `<div>${account}</div>`).join("")}
              <div>WhatsApp: ${COMPANY_INFO.whatsapp}</div>
              <div style="margin-top:12px;">Terima kasih telah memilih Choky Rental!</div>
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <Download className="h-4 w-4" />
              Professional invoice workspace
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Invoice Management</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Kelola draft, reminder, partial payment, dan preview invoice profesional yang siap dikirim ke customer.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-navy"
          >
            <Plus className="h-4 w-4" />
            Buat Invoice Baru
          </button>
        </div>
      </section>

      {overdueInvoices.length > 0 ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-rose-700">Invoice Overdue</h3>
              <p className="text-sm text-rose-600">Invoice lebih dari 7 hari belum dibayar otomatis ditandai overdue.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {overdueInvoices.slice(0, 3).map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => sendWhatsApp(invoice, true)}
                  className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Kirim Reminder {invoice.invoiceNo}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Invoice List</h3>
                <p className="text-sm text-slate-500">Filter, cari, dan kelola semua invoice rental.</p>
              </div>
              <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari nomor invoice atau customer..."
                  className="h-11 w-full bg-transparent text-sm outline-none"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={["all", "Draft", "Terkirim", "Sebagian Bayar", "Lunas", "Overdue"]} />
              <SelectFilter label="Periode" value={periodFilter} onChange={setPeriodFilter} options={["all", ...periodOptions]} />
              <SelectFilter label="Customer" value={customerFilter} onChange={setCustomerFilter} options={["all", ...customers.map((item) => item.id)]} labelForOption={(value) => value === "all" ? "Semua customer" : customers.find((item) => item.id === value)?.name ?? value} />
              <SelectFilter label="Kendaraan" value={vehicleFilter} onChange={setVehicleFilter} options={["all", ...vehicles.map((item) => item.id)]} labelForOption={(value) => value === "all" ? "Semua kendaraan" : vehicles.find((item) => item.id === value)?.name ?? value} />
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {["No Invoice", "Tanggal Buat", "Customer", "Kendaraan", "Periode Sewa", "Total", "Status", "Aksi"].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8">
                        <EmptyState
                          icon="📄"
                          title="Belum ada invoice"
                          message="Belum ada invoice yang cocok dengan filter saat ini. Buat invoice baru untuk mulai menagih customer."
                          actionLabel="Buat Invoice Baru"
                          onAction={openCreateModal}
                        />
                      </td>
                    </tr>
                  ) : null}
                  {paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-900">{invoice.invoiceNo}</td>
                      <td className="px-4 py-3">{invoice.issueDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                            {invoice.customer?.name
                              ?.split(" ")
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{invoice.customer?.name ?? "-"}</p>
                            <p className="text-xs text-slate-500">{invoice.customer?.phone ?? "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{invoice.vehicle?.name ?? "-"}</td>
                      <td className="px-4 py-3">{invoice.startDate} - {invoice.endDate}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(invoice.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_META[invoice.status]}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <RowAction onClick={() => setSelectedInvoiceId(invoice.id)} icon={Search} label="Lihat" />
                          <RowAction onClick={() => openEditModal(invoice)} icon={Pencil} label="Edit" />
                          <RowAction onClick={() => sendWhatsApp(invoice)} icon={MessageCircle} label="Kirim WA" />
                          <RowAction onClick={() => printInvoice(invoice)} icon={Printer} label="PDF" />
                          <RowAction onClick={() => deleteInvoice(invoice.id)} icon={Trash2} label="Hapus" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Menampilkan {filteredInvoices.length === 0 ? 0 : (page - 1) * 10 + 1} - {Math.min(page * 10, filteredInvoices.length)} dari {filteredInvoices.length}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Preview Invoice</h3>
              <p className="text-sm text-slate-500">Tampilan final invoice yang dikirim ke customer.</p>
            </div>
            {selectedInvoice ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_META[selectedInvoice.status]}`}>
                {selectedInvoice.status}
              </span>
            ) : null}
          </div>

          {selectedInvoice ? (
            <div className="mt-5 space-y-5">
              <div className="print-area">
                <InvoicePreview invoice={selectedInvoice} />
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={() => printInvoice(selectedInvoice)} icon={Printer}>Download PDF</ActionButton>
                <ActionButton onClick={() => sendWhatsApp(selectedInvoice)} icon={MessageCircle}>Kirim via WA</ActionButton>
                <ActionButton onClick={() => shareLink(selectedInvoice)} icon={Copy}>Share Link</ActionButton>
                {selectedInvoice.bookingId ? (
                  <ActionButton
                    onClick={() => navigate(`/bookings?bookingId=${selectedInvoice.bookingId}`)}
                    icon={Search}
                  >
                    Lihat Booking
                  </ActionButton>
                ) : null}
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <h4 className="font-semibold text-slate-900">Pembayaran</h4>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <input
                    value={paymentForm.amount}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, amount: formatMoneyInput(event.target.value) }))}
                    placeholder="Jumlah pembayaran"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                  />
                  <select
                    value={paymentForm.method}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                  >
                    {["Transfer BCA", "Transfer Mandiri", "Tunai", "QRIS"].map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => markAsPaid(selectedInvoice.id)}
                    className="rounded-2xl bg-teal px-4 py-2 text-sm font-semibold text-white"
                  >
                    {selectedInvoice.balanceDue <= 0 ? "Lunas" : "Tambah Payment"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentForm((current) => ({ ...current, amount: formatRupiah(selectedInvoice.balanceDue) }));
                      markAsPaid(selectedInvoice.id);
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Mark as Paid
                  </button>
                </div>

                {selectedInvoice.paymentHistory.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {selectedInvoice.paymentHistory.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                        <span>{payment.date} • {payment.method}</span>
                        <span className="font-semibold text-emerald-600">{formatRupiah(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
              Pilih invoice dari list untuk melihat preview.
            </div>
          )}
        </section>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-0 sm:p-4">
          <div className="animate-modal-in mx-auto min-h-screen bg-white shadow-2xl sm:min-h-0 sm:max-w-6xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {modalMode === "edit" ? "Edit Invoice" : "Buat Invoice Baru"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">Isi form invoice lalu lihat preview real-time di sisi kanan.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
              <form onSubmit={saveInvoice} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Sumber Invoice</span>
                    <select
                      value={invoiceForm.source}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, source: event.target.value }))}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                    >
                      <option value="booking">Pilih booking yang sudah ada</option>
                      <option value="manual">Buat manual</option>
                    </select>
                  </label>

                  {invoiceForm.source === "booking" ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Booking</span>
                      <select
                        value={invoiceForm.bookingId}
                        onChange={(event) => hydrateFromBooking(event.target.value)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                      >
                        <option value="">Pilih booking</option>
                        {bookingOptions.map((option) => (
                          <option key={option.booking.id} value={option.booking.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <FormSelect
                    label="Customer"
                    value={invoiceForm.customerId}
                    onChange={(value) => setInvoiceForm((current) => ({ ...current, customerId: value }))}
                    options={customers.map((item) => ({ value: item.id, label: item.name }))}
                  />
                  <FormSelect
                    label="Kendaraan"
                    value={invoiceForm.vehicleId}
                    onChange={(value) => setInvoiceForm((current) => ({ ...current, vehicleId: value }))}
                    options={vehicles.map((item) => ({ value: item.id, label: item.name }))}
                  />
                  <FormSelect
                    label="Sopir"
                    value={invoiceForm.driverId}
                    onChange={(value) => setInvoiceForm((current) => ({ ...current, driverId: value }))}
                    options={[{ value: "", label: "Tanpa sopir" }, ...drivers.map((item) => ({ value: item.id, label: item.name }))]}
                  />
                  <FormInput label="Tanggal Buat" type="date" value={invoiceForm.issueDate} onChange={(value) => setInvoiceForm((current) => ({ ...current, issueDate: value }))} />
                  <FormInput label="Jatuh Tempo" type="date" value={invoiceForm.dueDate} onChange={(value) => setInvoiceForm((current) => ({ ...current, dueDate: value }))} />
                  <FormInput label="Mulai" type="date" value={invoiceForm.startDate} onChange={(value) => setInvoiceForm((current) => ({ ...current, startDate: value }))} />
                  <FormInput label="Selesai" type="date" value={invoiceForm.endDate} onChange={(value) => setInvoiceForm((current) => ({ ...current, endDate: value }))} />
                  <FormInput label="Sewa Kendaraan" value={invoiceForm.subtotal} onChange={(value) => setInvoiceForm((current) => ({ ...current, subtotal: formatMoneyInput(value) }))} />
                  <FormInput label="Biaya Sopir" value={invoiceForm.driverFee} onChange={(value) => setInvoiceForm((current) => ({ ...current, driverFee: formatMoneyInput(value) }))} />
                  <FormInput label="BBM Estimasi" value={invoiceForm.fuelEstimate} onChange={(value) => setInvoiceForm((current) => ({ ...current, fuelEstimate: formatMoneyInput(value) }))} />
                  <FormInput label="Diskon" value={invoiceForm.discount} onChange={(value) => setInvoiceForm((current) => ({ ...current, discount: formatMoneyInput(value) }))} />
                  <FormInput label="DP Diterima" value={invoiceForm.depositPaid} onChange={(value) => setInvoiceForm((current) => ({ ...current, depositPaid: formatMoneyInput(value) }))} />
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Catatan</span>
                    <textarea
                      value={invoiceForm.notes}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                      className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                    />
                  </label>
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
                    Simpan Invoice
                  </button>
                </div>
              </form>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-4 text-sm font-medium text-slate-600">Preview Real-time</p>
                {previewInvoice ? <InvoicePreview invoice={previewInvoice} compact /> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectFilter({ label, value, onChange, options, labelForOption }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labelForOption
              ? labelForOption(option)
              : option === "all"
                ? `Semua ${label.toLowerCase()}`
                : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RowAction({ onClick, icon: Icon, label }) {
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

function ActionButton({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function InvoicePreview({ invoice, compact = false }) {
  return (
    <div className={`overflow-hidden rounded-[2rem] border border-slate-300 bg-white ${compact ? "scale-[0.96]" : ""}`}>
      <div className="flex items-start justify-between gap-5 border-b border-slate-300 px-6 py-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-lg font-bold text-white">
              CR
            </div>
            <div>
              <p className="font-bold text-slate-900">CHOKY RENTAL</p>
              <p className="text-sm text-slate-500">{COMPANY_INFO.name}</p>
              <p className="text-sm text-slate-500">{COMPANY_INFO.address}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">INVOICE</p>
          <p className="mt-1 text-sm text-slate-500">No: {invoice.invoiceNo}</p>
          <p className="text-sm text-slate-500">Tgl: {formatDateLong(invoice.issueDate)}</p>
          <p className="text-sm text-slate-500">Jatuh Tempo: {formatDateLong(invoice.dueDate)}</p>
        </div>
      </div>

      <div className="border-b border-slate-300 px-6 py-5">
        <p className="mb-2 text-sm font-semibold text-slate-500">TAGIHAN KEPADA:</p>
        <p className="font-semibold text-slate-900">{invoice.customer?.name ?? "-"}</p>
        <p className="text-sm text-slate-500">{invoice.customer?.phone ?? "-"}</p>
        <p className="text-sm text-slate-500">{invoice.customer?.address ?? "-"}</p>
      </div>

      <div className="border-b border-slate-300 px-6 py-5">
        <p className="mb-2 text-sm font-semibold text-slate-500">DETAIL LAYANAN:</p>
        <div className="grid gap-2 text-sm text-slate-700">
          <p>Kendaraan : {invoice.vehicle?.name ?? "-"}</p>
          <p>Sopir : {invoice.driver?.name ?? "-"}</p>
          <p>Mulai : {invoice.startDate}, 08:00</p>
          <p>Selesai : {invoice.endDate}, 08:00</p>
          <p>Durasi : {invoice.durationDays} hari</p>
        </div>
      </div>

      <div>
        <InvoiceRow label={`Sewa Kendaraan (${invoice.durationDays} hari)`} value={invoice.subtotal} />
        <InvoiceRow label={`Biaya Sopir (${invoice.durationDays} hari)`} value={invoice.driverFee} />
        <InvoiceRow label="BBM Estimasi" value={invoice.fuelEstimate} />
        <InvoiceRow label="Diskon" value={-invoice.discount} negative />
        <InvoiceRow label="DP Diterima" value={-invoice.depositPaid} negative />
        <InvoiceRow label="SISA TAGIHAN" value={invoice.balanceDue} strong />
      </div>

      <div className="border-t border-slate-300 px-6 py-5 text-sm text-slate-700">
        <p className="mb-2 font-semibold text-slate-500">Pembayaran via:</p>
        {COMPANY_INFO.bankAccounts.map((account) => (
          <p key={account}>{account}</p>
        ))}
        <p>WhatsApp: {COMPANY_INFO.whatsapp}</p>
      </div>

      <div className="border-t border-slate-300 px-6 py-4 text-sm text-slate-600">
        Terima kasih telah memilih Choky Rental! 🚗
      </div>
    </div>
  );
}

function InvoiceRow({ label, value, negative = false, strong = false }) {
  return (
    <div className={`flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm ${strong ? "font-bold text-slate-900" : "text-slate-700"}`}>
      <span>{label}</span>
      <span>{negative ? "- " : ""}{formatRupiah(Math.abs(value))}</span>
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
      >
        <option value="">Pilih {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormInput({ label, value, onChange, type = "text" }) {
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
