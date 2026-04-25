import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  Car,
  Gauge,
  MapPinned,
  Phone,
  Plus,
  Power,
  RadioTower,
  ShieldAlert,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TODAY } from "../lib/format";
import { useAppContext } from "../context/AppContext";

const MAP_BOUNDS = {
  minLat: -6.42,
  maxLat: -6.08,
  minLng: 106.78,
  maxLng: 107.08,
};

const LOCATION_LABELS = [
  "Jl. Ahmad Yani Bekasi",
  "Summarecon Bekasi",
  "Harapan Indah",
  "Cawang UKI",
  "Kalimalang",
  "Jatibening",
  "Pondok Gede",
  "Rawalumbu",
  "Bekasi Barat",
  "Cibubur Junction",
  "TMII Gate",
  "Pulo Gadung",
];

const GEOFENCES = [
  { id: "GF-1", name: "Zona Pool Bekasi", centerX: 28, centerY: 56, radius: 11 },
  { id: "GF-2", name: "Zona Jakarta Timur", centerX: 58, centerY: 38, radius: 13 },
  { id: "GF-3", name: "Bandara Corridor", centerX: 76, centerY: 30, radius: 10 },
];

const ALERT_TYPES = [
  { type: "Overspeed", tone: "text-rose-600 bg-rose-100", severity: "New" },
  { type: "Keluar Zona", tone: "text-amber-700 bg-amber-100", severity: "Acknowledged" },
  { type: "Tracker Low Battery", tone: "text-orange-700 bg-orange-100", severity: "Resolved" },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function toLatLng(x, y) {
  const lat = MAP_BOUNDS.maxLat - ((y / 100) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat));
  const lng = MAP_BOUNDS.minLng + ((x / 100) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng));
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

function getStatusMeta(status) {
  if (status === "online") {
    return {
      label: "Online",
      dot: "bg-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-200",
    };
  }
  if (status === "idle") {
    return {
      label: "Idle",
      dot: "bg-amber-300",
      badge: "bg-amber-500/15 text-amber-100",
    };
  }
  return {
    label: "Offline",
    dot: "bg-rose-400",
    badge: "bg-rose-500/15 text-rose-100",
  };
}

function minutesAgoLabel(value) {
  if (value < 1) return "baru saja";
  return `${value} menit lalu`;
}

function createInitialFleet(vehicles, bookings, customers, drivers) {
  return vehicles.map((vehicle, index) => {
    const activeBooking = bookings.find((booking) => booking.vehicleId === vehicle.id && booking.status === "active");
    const customer = activeBooking ? customers.find((item) => item.id === activeBooking.customerId) : null;
    const driver = activeBooking?.driverId ? drivers.find((item) => item.id === activeBooking.driverId) : null;
    const rented = vehicle.status === "rented";
    const maintenance = vehicle.status === "maintenance";
    const x = 22 + (index % 4) * 14 + (index > 3 ? 5 : 0);
    const y = 26 + Math.floor(index / 2) * 11;
    const trackerStatus = rented ? "online" : maintenance ? "offline" : index % 2 === 0 ? "idle" : "online";
    const speed = rented ? 25 + (index % 4) * 12 : trackerStatus === "idle" ? 0 : 8 + index * 2;
    const coords = toLatLng(x, y);

    return {
      ...vehicle,
      trackerStatus,
      currentBooking: activeBooking ?? null,
      activeCustomer: customer ?? null,
      activeDriver: driver ?? null,
      engineOn: rented || trackerStatus === "online",
      battery: 48 + (index % 4) * 11,
      speed,
      x,
      y,
      path: [{ x, y }],
      locationName: LOCATION_LABELS[index % LOCATION_LABELS.length],
      lastUpdateMinutes: rented ? 0 : 2 + index,
      geofenceEnabled: index % 3 !== 1,
      selectedGeofenceId: GEOFENCES[index % GEOFENCES.length].id,
      ...coords,
    };
  });
}

function createInitialAlerts(fleet) {
  return fleet.slice(0, 4).map((vehicle, index) => ({
    id: `ALT-${index + 1}`,
    timestamp: new Date(TODAY.getTime() - index * 18 * 60 * 1000).toISOString(),
    type: ALERT_TYPES[index % ALERT_TYPES.length].type,
    tone: ALERT_TYPES[index % ALERT_TYPES.length].tone,
    status: ALERT_TYPES[index % ALERT_TYPES.length].severity,
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    location: vehicle.locationName,
  }));
}

export default function GPS() {
  const navigate = useNavigate();
  const {
    state: { vehicles, bookings, customers, drivers },
  } = useAppContext();
  const initialFleet = useMemo(
    () => createInitialFleet(vehicles, bookings, customers, drivers),
    [vehicles, bookings, customers, drivers],
  );
  const [fleet, setFleet] = useState(initialFleet);
  const [alerts, setAlerts] = useState(() => createInitialAlerts(initialFleet));
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => initialFleet[0]?.id ?? null);

  const selectedVehicle = useMemo(
    () => fleet.find((vehicle) => vehicle.id === selectedVehicleId) ?? fleet[0] ?? null,
    [fleet, selectedVehicleId],
  );

  useEffect(() => {
    setFleet(initialFleet);
    setAlerts(createInitialAlerts(initialFleet));
    if (!selectedVehicleId && initialFleet[0]) {
      setSelectedVehicleId(initialFleet[0].id);
    }
  }, [initialFleet]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFleet((currentFleet) =>
        currentFleet.map((vehicle) => {
          let nextX = vehicle.x;
          let nextY = vehicle.y;
          let speed = vehicle.speed;
          let trackerStatus = vehicle.trackerStatus;

          if (vehicle.status === "rented") {
            const deltaX = (Math.random() - 0.5) * 3.8;
            const deltaY = (Math.random() - 0.5) * 3.2;
            nextX = clamp(vehicle.x + deltaX, 8, 92);
            nextY = clamp(vehicle.y + deltaY, 12, 84);
            speed = clamp(Math.round(vehicle.speed + (Math.random() - 0.45) * 18), 8, 80);
            trackerStatus = speed <= 8 ? "idle" : "online";
          } else if (vehicle.status === "available") {
            speed = Math.random() > 0.76 ? Math.round(Math.random() * 12) : 0;
            trackerStatus = speed > 0 ? "online" : "idle";
            nextX = clamp(vehicle.x + (Math.random() - 0.5) * 0.8, 8, 92);
            nextY = clamp(vehicle.y + (Math.random() - 0.5) * 0.8, 12, 84);
          } else {
            speed = 0;
            trackerStatus = "offline";
          }

          const coords = toLatLng(nextX, nextY);
          const locationName = randomFrom(LOCATION_LABELS);
          const path = [...vehicle.path, { x: nextX, y: nextY }].slice(-12);

          return {
            ...vehicle,
            x: nextX,
            y: nextY,
            lat: coords.lat,
            lng: coords.lng,
            speed,
            trackerStatus,
            engineOn: trackerStatus !== "offline" && speed > 0,
            battery: clamp(vehicle.battery - (Math.random() > 0.72 ? 1 : 0), 12, 100),
            locationName,
            path,
            lastUpdateMinutes: 0,
          };
        }),
      );

      setAlerts((currentAlerts) => {
        if (Math.random() > 0.55) return currentAlerts;

        const movingFleet = fleet.filter((vehicle) => vehicle.status === "rented");
        const target = randomFrom(movingFleet.length ? movingFleet : fleet);
        const template = randomFrom(ALERT_TYPES);
        const nextAlert = {
          id: `ALT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: template.type,
          tone: template.tone,
          status: template.severity,
          vehicleId: target.id,
          vehicleName: target.name,
          location: target.locationName,
        };

        return [nextAlert, ...currentAlerts].slice(0, 10);
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [fleet]);

  const geofenceStatus = useMemo(() => {
    return fleet.map((vehicle) => {
      const geofence = GEOFENCES.find((item) => item.id === vehicle.selectedGeofenceId) ?? GEOFENCES[0];
      const dx = vehicle.x - geofence.centerX;
      const dy = vehicle.y - geofence.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return {
        vehicleId: vehicle.id,
        name: vehicle.name,
        geofenceName: geofence.name,
        enabled: vehicle.geofenceEnabled,
        inside: distance <= geofence.radius,
      };
    });
  }, [fleet]);

  const recentAlerts = alerts.slice(0, 8);

  function toggleGeofence(vehicleId) {
    setFleet((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId
          ? { ...vehicle, geofenceEnabled: !vehicle.geofenceEnabled }
          : vehicle,
      ),
    );
  }

  function handleBlockEngine(vehicleId) {
    setFleet((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              engineOn: false,
              speed: 0,
              trackerStatus: "idle",
            }
          : vehicle,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-navy via-slate-900 to-teal p-6 text-white shadow-xl shadow-slate-300/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
              <RadioTower className="h-4 w-4" />
              GPS live simulation mode
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">GPS Tracking Simulator</h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Armada bergerak otomatis setiap 3 detik untuk kebutuhan demo. Untuk production nanti tinggal diganti ke API tracker asli.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <GpsPill label="Online" value={fleet.filter((item) => item.trackerStatus === "online").length} />
            <GpsPill label="Idle" value={fleet.filter((item) => item.trackerStatus === "idle").length} />
            <GpsPill label="Offline" value={fleet.filter((item) => item.trackerStatus === "offline").length} />
            <GpsPill label="Alert Aktif" value={recentAlerts.filter((item) => item.status === "New").length} blink />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-[2rem] bg-navy p-5 text-white shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Fleet Status</h3>
                <p className="text-sm text-white/60">Klik unit untuk highlight di peta.</p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                {fleet.length} unit
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {fleet.map((vehicle) => {
                const meta = getStatusMeta(vehicle.trackerStatus);
                const active = selectedVehicleId === vehicle.id;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      active
                        ? "border-teal bg-white/10 shadow-lg shadow-black/10"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{vehicle.name}</p>
                        <p className="mt-1 text-xs text-white/60">{vehicle.plate}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <GpsInline label="Kecepatan" value={`${vehicle.speed} km/h`} pulse={vehicle.trackerStatus === "online"} />
                      <GpsInline label="Update" value={minutesAgoLabel(vehicle.lastUpdateMinutes)} />
                    </div>
                    <p className="mt-3 text-xs text-white/65">{vehicle.locationName}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Geofence Panel</h3>
                <p className="text-sm text-slate-500">Zona aktif per kendaraan.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Tambah Zona
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {geofenceStatus.map((item) => (
                <div key={item.vehicleId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.geofenceName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGeofence(item.vehicleId)}
                      className={`relative h-7 w-12 rounded-full transition ${
                        item.enabled ? "bg-teal" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          item.enabled ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.inside
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {item.inside ? "Dalam Zona" : "Di Luar Zona"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Peta Interaktif Simulasi Bekasi - Jakarta</h3>
                <p className="text-sm text-slate-500">Pin kendaraan bergerak setiap 3 detik dan meninggalkan jejak rute mini.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Demo tanpa Google Maps API key
              </div>
            </div>

            <div className="relative h-[520px] overflow-hidden bg-slate-100">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:44px_44px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,184,169,0.12),transparent_28%),radial-gradient(circle_at_75%_24%,rgba(13,31,78,0.12),transparent_22%),radial-gradient(circle_at_58%_72%,rgba(56,189,248,0.08),transparent_26%)]" />

              <div className="absolute left-[16%] top-[58%] text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Bekasi Pool Area
              </div>
              <div className="absolute left-[48%] top-[38%] text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Jakarta Timur Corridor
              </div>
              <div className="absolute left-[71%] top-[24%] text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Airport Direction
              </div>

              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {fleet.map((vehicle) => (
                  <polyline
                    key={vehicle.id}
                    points={vehicle.path.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke={selectedVehicleId === vehicle.id ? "#0d1f4e" : "#94a3b8"}
                    strokeWidth={selectedVehicleId === vehicle.id ? 0.7 : 0.35}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={selectedVehicleId === vehicle.id ? 0.95 : 0.55}
                  />
                ))}
                {GEOFENCES.map((zone) => (
                  <circle
                    key={zone.id}
                    cx={zone.centerX}
                    cy={zone.centerY}
                    r={zone.radius}
                    fill="rgba(0,184,169,0.06)"
                    stroke="rgba(0,184,169,0.35)"
                    strokeDasharray="2 2"
                  />
                ))}
              </svg>

              {fleet.map((vehicle) => {
                const meta = getStatusMeta(vehicle.trackerStatus);
                const active = selectedVehicleId === vehicle.id;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${vehicle.x}%`, top: `${vehicle.y}%` }}
                    title={`${vehicle.name} • ${vehicle.locationName}`}
                  >
                    <div className="relative">
                      {vehicle.trackerStatus === "online" ? (
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
                      ) : null}
                      <div
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-white shadow-lg ${
                          active ? "border-navy bg-navy scale-110" : "border-white bg-teal"
                        }`}
                      >
                        <Car className="h-5 w-5" />
                      </div>
                      <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                        {vehicle.speed} km/h
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedVehicle ? (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900">{selectedVehicle.name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusMeta(selectedVehicle.trackerStatus).badge}`}>
                        {getStatusMeta(selectedVehicle.trackerStatus).label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedVehicle.plate} • {selectedVehicle.locationName}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ControlButton icon={Phone} label="Hubungi Sopir" />
                    <ControlButton icon={User} label="Hubungi Customer" />
                    <ControlButton
                      icon={Car}
                      label="Buka Fleet"
                      onClick={() => navigate(`/fleet?vehicleId=${selectedVehicle.id}`)}
                    />
                    <ControlButton icon={ShieldAlert} label="Blokir Mesin" onClick={() => handleBlockEngine(selectedVehicle.id)} danger />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile label="Koordinat GPS" value={`${selectedVehicle.lat}, ${selectedVehicle.lng}`} />
                  <MetricTile label="Lokasi Terakhir" value={selectedVehicle.locationName} />
                  <MetricTile label="Status Mesin" value={selectedVehicle.engineOn ? "ON" : "OFF"} />
                  <MetricTile label="Battery Tracker" value={`${selectedVehicle.battery}%`} />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="rounded-[2rem] bg-slate-50 p-5">
                    <p className="text-sm font-medium text-slate-500">Speedometer Visual</p>
                    <div className="mt-5 flex justify-center">
                      <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-[16px] border-slate-200 bg-white">
                        <div
                          className="absolute inset-0 rounded-full border-[16px] border-transparent border-t-teal border-r-teal"
                          style={{ transform: `rotate(${selectedVehicle.speed * 2.25}deg)` }}
                        />
                        <div className="text-center">
                          <p className="text-4xl font-bold text-slate-900">{selectedVehicle.speed}</p>
                          <p className="text-sm text-slate-500">km/h</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-slate-50 p-5">
                    <h4 className="text-lg font-bold text-slate-900">Info Kendaraan & Penyewa Aktif</h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <MetricTile label="Penyewa" value={selectedVehicle.activeCustomer?.name ?? "Tidak ada booking aktif"} />
                      <MetricTile label="Sopir" value={selectedVehicle.activeDriver?.name ?? "Belum ditugaskan"} />
                      <MetricTile label="Booking" value={selectedVehicle.currentBooking?.id ?? "-"} />
                      <MetricTile label="Update Terakhir" value={minutesAgoLabel(selectedVehicle.lastUpdateMinutes)} />
                    </div>
                  </div>
                </div>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <h3 className="text-lg font-bold text-slate-900">Alert Log</h3>
                </div>

                <div className="mt-4 space-y-3">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-2xl border p-4 ${
                        alert.status === "New" ? "animate-pulse border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{alert.type}</p>
                          <p className="mt-1 text-sm text-slate-500">{alert.vehicleName}</p>
                          <p className="mt-1 text-xs text-slate-400">{alert.location}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.tone}`}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        {new Date(alert.timestamp).toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function GpsPill({ label, value, blink = false }) {
  return (
    <div className={`rounded-2xl bg-white/10 p-4 backdrop-blur-sm ${blink ? "animate-pulse" : ""}`}>
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function GpsInline({ label, value, pulse = false }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {pulse ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" /> : null}
        <p className="font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${
        danger
          ? "bg-rose-600 text-white"
          : "border border-slate-200 bg-white text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MetricTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
