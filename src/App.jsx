import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Fleet from "./pages/Fleet";
import Bookings from "./pages/Bookings";
import GpsTracking from "./pages/GpsTracking";
import Finance from "./pages/Finance";
import Invoice from "./pages/Invoice";
import Drivers from "./pages/Drivers";
import Maintenance from "./pages/Maintenance";
import Customers from "./pages/Customers";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/gps" element={<GpsTracking />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/invoice" element={<Invoice />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
