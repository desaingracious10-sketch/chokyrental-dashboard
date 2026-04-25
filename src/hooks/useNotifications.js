import { useMemo } from "react";
import { diffDays, TODAY } from "../lib/format";
import { useAppContext } from "../context/AppContext";

function createDocDate(baseDate, offsetDays) {
  const value = new Date(baseDate);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function getVehicleDocs(vehicle, index) {
  const anchor = new Date(TODAY);
  return {
    stnkExpiry: vehicle.stnkExpiry ?? createDocDate(anchor, 10 + index * 17),
    kirExpiry: vehicle.kirExpiry ?? createDocDate(anchor, 21 + index * 13),
    insuranceExpiry: vehicle.insuranceExpiry ?? createDocDate(anchor, 35 + index * 12),
  };
}

export function useNotifications() {
  const {
    state: { vehicles, bookings, invoices },
  } = useAppContext();

  return useMemo(() => {
    const lateBookings = bookings
      .filter((booking) => booking.status === "active" && diffDays(TODAY, booking.endDate) > 0)
      .map((booking) => ({
        id: `late-booking-${booking.id}`,
        entity: "bookings",
        entityId: booking.id,
        priority: "critical",
        title: "Kendaraan terlambat kembali",
        description: `${booking.id} terlambat ${diffDays(TODAY, booking.endDate)} hari.`,
        path: `/bookings?bookingId=${booking.id}`,
      }));

    const documentAlerts = vehicles.flatMap((vehicle, index) => {
      const docs = getVehicleDocs(vehicle, index);
      return [
        ["STNK", docs.stnkExpiry],
        ["KIR", docs.kirExpiry],
        ["Asuransi", docs.insuranceExpiry],
      ]
        .filter(([, expiry]) => diffDays(expiry, TODAY) < 30)
        .map(([label, expiry]) => ({
          id: `${label}-${vehicle.id}`,
          entity: "maintenance",
          entityId: vehicle.id,
          priority: diffDays(expiry, TODAY) < 0 ? "critical" : "warning",
          title: `${label} mau expire`,
          description: `${vehicle.name} jatuh tempo ${expiry}.`,
          path: `/maintenance?vehicleId=${vehicle.id}`,
        }));
    });

    const overdueInvoices = invoices
      .filter((invoice) => invoice.status === "Overdue" || (invoice.balanceDue > 0 && diffDays(TODAY, invoice.dueDate) > 7))
      .map((invoice) => ({
        id: `overdue-invoice-${invoice.id}`,
        entity: "invoice",
        entityId: invoice.id,
        priority: "warning",
        title: "Invoice overdue",
        description: `${invoice.invoiceNo} belum dibayar ${diffDays(TODAY, invoice.dueDate)} hari.`,
        path: `/invoice?invoiceId=${invoice.id}`,
      }));

    const notifications = [...lateBookings, ...documentAlerts, ...overdueInvoices].sort((a, b) => {
      const score = { critical: 0, warning: 1, info: 2 };
      return score[a.priority] - score[b.priority];
    });

    return {
      notifications,
      totalCount: notifications.length,
      bookingCount: lateBookings.length,
      maintenanceCount: documentAlerts.length,
      invoiceCount: overdueInvoices.length,
    };
  }, [bookings, invoices, vehicles]);
}
